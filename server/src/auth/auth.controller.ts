// Contains controller functions for handling auth route requests and responses.
const authController = {};

authController.verifyUser = (req = Request, res = Response, next = Promise) => {
  console.log('verifyUser works');

  const inputUsername = req.body.user;
  const inputPassword = req.body.pass;

  console.log('Login attempt:', req.body);

  if (inputUsername === 'codesmith' && inputPassword === 'ilovetesting') {
    res.cookie('token', 'admin');
    return next();
  } else {
    return res.send('unsuccessful login attempt');
  }
};

export default authController;
