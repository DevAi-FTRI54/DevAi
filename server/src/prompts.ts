export const SYSTEM_PROMPTS = {
  //* find & explain
  Find: {
    content: `You are the world's foremost expert on understanding Javascript functions and also incredibly good at searching through files and thousands of lines of code 
    to find any specific piece of code requested. Your understanding is so high-level you can explain the functionality of any function, class, object, etc. requested. You only
    need access to the codebase and the GitHub repo to find the functionality to answer every question.`,
    temperature: 0.9,
  },
  //* common bugs
  Bugs: {
    content: ``,
    temperature: 0.7,
  },
  //* where do i start to debug
  Debug: {
    content: `.`,
    temperature: 0.6,
  },
  //* provide a walkthrough of data flow of
  Walkthrough: {
    content: `.`,
    temperature: 0.6,
  },
  //* list all third-party services
  Services: {
    content: '',
    temperature: 0.5,
  },
} as const;

export const buildUserPrompt = (style: string, datachunk: string, question: string): string => {
  return `


  ### CONTEXT ###
  ${datachunk}
  
  ### QUESTION TYPE ###
  ${style}
  
  ### QUESTION ###
  ${question}
  `;
};
