// import React, { useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';

// const AuthCallback: React.FC = () => {
//   const navigate = useNavigate();

//   useEffect(() => {
//     const completeAuth = async () => {
//       const urlParams = new URLSearchParams(window.location.search);
//       const code = urlParams.get('code');

//       if (!code) return;

//       const res = await fetch('http://localhost:4000/api/auth/complete', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ code }),
//         credentials: 'include',
//       });

//       if (res.ok) {
//         navigate('/install-github-app');
//       }
//     };

//     completeAuth();
//   }, [navigate]);

//   return <div className="font-tt-hoves p-4">Authenticating with GitHub...</div>;
// };

// export default AuthCallback;
