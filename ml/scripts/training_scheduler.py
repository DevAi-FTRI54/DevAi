#!/usr/bin/env python3
"""
DevAI Training Scheduler
Automated fine-tuning job scheduler for weekly training runs
"""

import os
import json
import time
import logging
import schedule
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/devai_scheduler.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

class TrainingScheduler:
    def __init__(self, base_path: str = None, min_pairs: int = 200):
        self.base_path = Path(base_path) if base_path else Path(__file__).parent.parent
        self.min_pairs = min_pairs
        self.training_manager_path = self.base_path / "scripts" / "training_manager.py"
        self.token = os.getenv('FINE_TUNING_TOKEN')
        
        if not self.token:
            raise ValueError("FINE_TUNING_TOKEN environment variable required")
        
        if not self.training_manager_path.exists():
            raise FileNotFoundError(f"Training manager not found: {self.training_manager_path}")
    
    def check_training_readiness(self) -> dict:
        """Check if we have enough data for training"""
        try:
            cmd = [
                "python3", str(self.training_manager_path),
                "--token", self.token,
                "--min-pairs", str(self.min_pairs),
                "check"
            ]
            
            logger.info(f"Checking training readiness: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=self.base_path)
            
            # Parse output to determine readiness
            output = result.stdout
            ready = "Ready for training: ✅ YES" in output
            
            # Extract current pairs count
            current_pairs = 0
            for line in output.split('\n'):
                if "Current conversation pairs:" in line:
                    try:
                        current_pairs = int(line.split(':')[1].strip())
                    except (ValueError, IndexError):
                        pass
            
            return {
                "ready": ready,
                "current_pairs": current_pairs,
                "output": output,
                "return_code": result.returncode
            }
            
        except Exception as e:
            logger.error(f"Error checking readiness: {e}")
            return {"ready": False, "error": str(e)}
    
    def run_training_workflow(self, auto_mode: bool = True) -> bool:
        """Execute the complete training workflow"""
        try:
            cmd = [
                "python3", str(self.training_manager_path),
                "--token", self.token,
                "--min-pairs", str(self.min_pairs),
                "workflow"
            ]
            
            if auto_mode:
                cmd.append("--auto")
            
            logger.info(f"Starting training workflow: {' '.join(cmd)}")
            result = subprocess.run(cmd, cwd=self.base_path, text=True)
            
            success = result.returncode == 0
            
            if success:
                logger.info("Training workflow completed successfully")
            else:
                logger.error(f"Training workflow failed with return code: {result.returncode}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error running training workflow: {e}")
            return False
    
    def scheduled_training_job(self):
        """Main scheduled job function"""
        logger.info("=" * 50)
        logger.info("🤖 DevAI Scheduled Training Job Started")
        logger.info(f"⏰ Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"🎯 Minimum pairs required: {self.min_pairs}")
        
        try:
            # 1. Check readiness
            logger.info("1️⃣ Checking training readiness...")
            readiness = self.check_training_readiness()
            
            if not readiness.get("ready", False):
                current_pairs = readiness.get("current_pairs", 0)
                deficit = self.min_pairs - current_pairs
                logger.info(f"❌ Not ready for training")
                logger.info(f"📊 Current pairs: {current_pairs}, Need: {deficit} more")
                logger.info("⏭️ Skipping training until next week")
                return
            
            logger.info(f"✅ Ready for training with {readiness.get('current_pairs', 0)} pairs")
            
            # 2. Run training workflow
            logger.info("2️⃣ Starting automated training workflow...")
            success = self.run_training_workflow(auto_mode=True)
            
            if success:
                logger.info("🎉 Scheduled training completed successfully!")
                self._send_success_notification()
            else:
                logger.error("❌ Scheduled training failed")
                self._send_failure_notification()
                
        except Exception as e:
            logger.error(f"❌ Scheduled job error: {e}")
            self._send_failure_notification(str(e))
        
        logger.info("🤖 DevAI Scheduled Training Job Finished")
        logger.info("=" * 50)
    
    def _send_success_notification(self):
        """Send success notification (placeholder for email/Slack/etc.)"""
        logger.info("📧 Sending success notification...")
        # TODO: Implement email/Slack notification
        pass
    
    def _send_failure_notification(self, error: str = None):
        """Send failure notification (placeholder for email/Slack/etc.)"""
        logger.info(f"📧 Sending failure notification: {error or 'Unknown error'}")
        # TODO: Implement email/Slack notification
        pass
    
    def start_scheduler(self, weekly_time: str = "02:00"):
        """Start the scheduling daemon"""
        logger.info("🚀 Starting DevAI Training Scheduler")
        logger.info(f"⏰ Weekly training time: Sunday {weekly_time}")
        logger.info(f"📁 Base path: {self.base_path}")
        logger.info(f"🎯 Minimum pairs: {self.min_pairs}")
        
        # Schedule weekly job
        schedule.every().sunday.at(weekly_time).do(self.scheduled_training_job)
        
        # Also allow manual trigger via file
        trigger_file = self.base_path / "trigger_training_now"
        
        logger.info("⏳ Scheduler running... Press Ctrl+C to stop")
        logger.info(f"💡 Manual trigger: touch {trigger_file}")
        
        try:
            while True:
                # Check for manual trigger
                if trigger_file.exists():
                    logger.info("🔥 Manual trigger detected!")
                    trigger_file.unlink()  # Remove trigger file
                    self.scheduled_training_job()
                
                # Run scheduled jobs
                schedule.run_pending()
                time.sleep(60)  # Check every minute
                
        except KeyboardInterrupt:
            logger.info("🛑 Scheduler stopped by user")
        except Exception as e:
            logger.error(f"❌ Scheduler error: {e}")
    
    def run_once(self):
        """Run training job once (for testing)"""
        logger.info("🧪 Running training job once (test mode)")
        self.scheduled_training_job()


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="DevAI Training Scheduler")
    parser.add_argument("--base-path", help="Base path to DevAI ML directory")
    parser.add_argument("--min-pairs", type=int, default=200, help="Minimum training pairs")
    parser.add_argument("--time", default="02:00", help="Weekly training time (HH:MM)")
    parser.add_argument("--run-once", action="store_true", help="Run once instead of scheduling")
    parser.add_argument("--check-only", action="store_true", help="Only check readiness")
    
    args = parser.parse_args()
    
    try:
        scheduler = TrainingScheduler(args.base_path, args.min_pairs)
        
        if args.check_only:
            readiness = scheduler.check_training_readiness()
            print(json.dumps(readiness, indent=2))
        elif args.run_once:
            scheduler.run_once()
        else:
            scheduler.start_scheduler(args.time)
            
    except Exception as e:
        logger.error(f"❌ Scheduler initialization error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
