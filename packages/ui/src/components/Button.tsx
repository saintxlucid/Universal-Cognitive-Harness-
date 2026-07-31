import React from 'react';

type ButtonProps = {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
};

export default function Button({ children, variant = 'primary' }: ButtonProps) {
  return (
    <button className={`button button-${variant}`} type="button">
      {children}
    </button>
  );
}
