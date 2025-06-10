import * as React from 'react';
import { styled } from '@mui/material/styles';
import ArrowForwardIosSharpIcon from '@mui/icons-material/ArrowForwardIosSharp';
import MuiAccordion from '@mui/material/Accordion';
import type { AccordionProps } from '@mui/material/Accordion';
import MuiAccordionSummary, { accordionSummaryClasses } from '@mui/material/AccordionSummary';
import type { AccordionSummaryProps } from '@mui/material/AccordionSummary';
import MuiAccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';

const Accordion = styled((props: AccordionProps) => <MuiAccordion disableGutters elevation={0} square {...props} />)(
  ({ theme }) => ({
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: '#fff',
    '&:not(:last-child)': {
      borderBottom: 0,
    },
    '&::before': {
      display: 'none',
    },
    // Subtle shadow on expanded panel
    '&.Mui-expanded': {
      boxShadow: '0 2px 10px 0 rgba(30,30,30,0.08)',
      backgroundColor: '#f5f7fa',
    },
  })
);

const AccordionSummary = styled((props: AccordionSummaryProps) => (
  <MuiAccordionSummary expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: '1rem', color: '#333' }} />} {...props} />
))(({ theme }) => ({
  backgroundColor: 'rgba(0,0,0, .02)',
  flexDirection: 'row-reverse',
  fontWeight: 500,
  fontSize: '1rem',
  [`& .${accordionSummaryClasses.expandIconWrapper}.${accordionSummaryClasses.expanded}`]: {
    transform: 'rotate(90deg)',
  },
  [`& .${accordionSummaryClasses.content}`]: {
    marginLeft: theme.spacing(1),
  },
  // Make text color dark for readability
  color: '#111',
}));

const AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => ({
  padding: theme.spacing(2),
  borderTop: '1px solid rgba(0, 0, 0, .08)',
  backgroundColor: '#fafafa',
  color: '#222',
  fontSize: '1rem',
}));

const FAQ: React.FC = () => {
  const [expanded, setExpanded] = React.useState<string | false>(false);

  const handleChange = (panel: string) => (_: React.SyntheticEvent, newExpanded: boolean) => {
    setExpanded(newExpanded ? panel : false);
  };

  return (
    <div className="bg-[#171717] min-h-screen py-12 px-2">
      <div className="max-w-3xl mx-auto">
        {/* FAQ Title */}
        <div className="text-center mb-8">
          <h3 className="mt-24 text-4xl font-bold text-white mb-2" style={{ fontFamily: 'TTHoves' }}>
            Frequently Asked Questions
          </h3>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Everything you need to know about devAi, AI-powered development, and how it can help you.
          </p>
        </div>
        {/* Card */}
        <div className="bg-gray-400 rounded-2xl shadow-xl p-2 sm:p-4">
          <Accordion expanded={expanded === 'panel1'} onChange={handleChange('panel1')}>
            <AccordionSummary aria-controls="panel1d-content" id="panel1d-header">
              <Typography component="span">What is dev.ai?</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography>
                devAi is an AI-powered assistant built for software engineers.
                <br />
                It helps you debug code, search documentation, automate tasks, and learn new technologies—directly in
                your workflow.
              </Typography>
            </AccordionDetails>
          </Accordion>
          <Accordion expanded={expanded === 'panel2'} onChange={handleChange('panel2')}>
            <AccordionSummary aria-controls="panel2d-content" id="panel2d-header">
              <Typography component="span">Who is devAi for?</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography>
                devAi is designed for developers of all levels, from bootcamp students to experienced engineers, who
                want to work faster and smarter using AI.
              </Typography>
            </AccordionDetails>
          </Accordion>
          <Accordion expanded={expanded === 'panel3'} onChange={handleChange('panel3')}>
            <AccordionSummary aria-controls="panel3d-content" id="panel3d-header">
              <Typography component="span">What can devAi do?</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography>
                devAi can answer technical questions, explain code, generate code snippets from your codebase, help with
                debugging, review pull requests, and provide instant documentation—all within your dev environment using
                a read-only clone of your GitHub Repository.
              </Typography>
            </AccordionDetails>
          </Accordion>
          <Accordion expanded={expanded === 'panel4'} onChange={handleChange('panel4')}>
            <AccordionSummary aria-controls="panel4d-content" id="panel4d-header">
              <Typography component="span">How does devAi work?</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography>
                devAi uses advanced large language models (LLMs) to process your queries and code context, returning
                relevant, actionable answers in real time.
              </Typography>
            </AccordionDetails>
          </Accordion>
          <Accordion expanded={expanded === 'panel5'} onChange={handleChange('panel5')}>
            <AccordionSummary aria-controls="panel5d-content" id="panel5d-header">
              <Typography component="span">Is my code safe with devAi? </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography>
                Your code and questions are processed securely. We never share your data with third parties. For more
                details, see our Privacy Policy.
              </Typography>
            </AccordionDetails>
          </Accordion>
          <Accordion expanded={expanded === 'panel6'} onChange={handleChange('panel6')}>
            <AccordionSummary aria-controls="panel6d-content" id="panel6-header">
              <Typography component="span">Can devAi access my private repositories or files? </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography>
                Only if you grant explicit permission. devAi will never access your codebase or repo content without
                your consent.
              </Typography>
            </AccordionDetails>
          </Accordion>
          <Accordion expanded={expanded === 'panel7'} onChange={handleChange('panel7')}>
            <AccordionSummary aria-controls="panel7d-content" id="panel7-header">
              <Typography component="span">Does devAi support multiple programming languages?</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography>
                Yes. devAi works with all major languages including:
                <br />
                JavaScript (js) <br />
                React (jsx, tsx) <br />
                TypeScript (ts)
                <br />
                HyperTextMarkupLanguage (html)
                <br />
                Cascading Style Sheet (css)
                <br />
              </Typography>
            </AccordionDetails>
          </Accordion>
          <Accordion expanded={expanded === 'panel8'} onChange={handleChange('panel8')}>
            <AccordionSummary aria-controls="panel8d-content" id="panel8-header">
              <Typography component="span">What makes devAi different from ChatGPT or other AI tools?</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography>
                devAi is built for developers, with context-aware code understanding, <br />
                deep integration into your tools, and features specifically <br /> designed for engineering workflows.
              </Typography>
            </AccordionDetails>
          </Accordion>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
