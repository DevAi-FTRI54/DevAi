import { useNavigate } from 'react-router-dom';

const useLogout = () => {
  const navigate = useNavigate();

  return () => {
    sessionStorage.removeItem('accessToken');
    navigate('/login');
  };
};

export default useLogout;
