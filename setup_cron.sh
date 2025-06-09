#!/bin/bash
# Simple cron job setup for DevAI training

echo "Setting up DevAI training cron job..."

# Create the cron job entry
CRON_JOB="0 2 * * 0 cd $(pwd)/ml && source venv/bin/activate && python3 scripts/training_manager.py workflow --output output/training_data.json >> logs/training.log 2>&1"

# Add to crontab (runs Sundays at 2 AM)
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "✅ Cron job added: Weekly training on Sundays at 2 AM"
echo "📝 View with: crontab -l"
echo "🗑️  Remove with: crontab -r"
