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
    '&:not(:last-child)': {
      borderBottom: 0,
    },
    '&::before': {
      display: 'none',
    },
  })
);

const AccordionSummary = styled((props: AccordionSummaryProps) => (
  <MuiAccordionSummary expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: '0.9rem' }} />} {...props} />
))(({ theme }) => ({
  backgroundColor: 'rgba(0,0,0, .03)',
  flexDirection: 'row-reverse',
  [`& .${accordionSummaryClasses.expandIconWrapper}.${accordionSummaryClasses.expanded}`]: {
    transform: 'rotate(90deg)',
  },
  [`& .${accordionSummaryClasses.content}`]: {
    marginLeft: theme.spacing(1),
  },
  ...theme.applyStyles('dark', {
    backgroundColor: 'rgba(255, 255, 255, .05)',
  }),
}));
const AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => ({
  padding: theme.spacing(2),
  borderTop: '1px solid rgba(0, 0, 0, .125)',
}));

const FAQ: React.FC = () => {
  const [expanded, setExpanded] = React.useState<string | false>('null');

  const handleChange = (panel: string) => (_: React.SyntheticEvent, newExpanded: boolean) => {
    setExpanded(newExpanded ? panel : false);
  };

  return (
    <div>
      <div>
        <h3>Frequently Asked Questions</h3>
      </div>
      <Accordion expanded={expanded === 'panel1'} onChange={handleChange('panel1')}>
        <AccordionSummary aria-controls="panel1d-content" id="panel1d-header">
          <Typography component="span">How can I connect to MongoDB's Database</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            To connect to the MongoDB you must request a Mongodb_URI link from your supervisor. This can then be added
            to <br />
            your .env file and you can use mongoose vs code extension to connect to a new databse.
          </Typography>
        </AccordionDetails>
      </Accordion>
      <Accordion expanded={expanded === 'panel2'} onChange={handleChange('panel2')}>
        <AccordionSummary aria-controls="panel2d-content" id="panel2d-header">
          <Typography component="span">What does the function Accordion do?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            The accordion function is going to allow a user to navigate through a Q and A style enironment <br /> where
            you can select one question to look at the answer at a time.
          </Typography>
        </AccordionDetails>
      </Accordion>
      <Accordion expanded={expanded === 'panel3'} onChange={handleChange('panel3')}>
        <AccordionSummary aria-controls="panel3d-content" id="panel3d-header">
          <Typography component="span">Find where the Authentication files begin for JWT</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            You must navigate to your server and then locate the folder JWT.js to learn more about the Authentication.
          </Typography>
        </AccordionDetails>
      </Accordion>
    </div>
  );
};

export default FAQ;
