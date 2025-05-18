import app from './app.js';
import 'dotenv/config';

// Setup MongoDB integration

// Port
const PORT = parseInt(process.env.PORT || '3000, 10');
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
