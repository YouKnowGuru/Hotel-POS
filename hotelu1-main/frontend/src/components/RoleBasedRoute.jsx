import React from 'react';
import { Navigate } from 'react-router-dom';
import NoAccessMessage from './NoAccessMessage';

const RoleBasedRoute = ({ children, allowedRoles = [] }) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = user.role;

  if (!allowedRoles.includes(userRole)) {
    return <NoAccessMessage />;
  }

  return children;
};

export default RoleBasedRoute;
