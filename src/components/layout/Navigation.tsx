// components/layout/Navigation.tsx

import { NavLink } from 'react-router-dom';

export const Navigation = () => {
  return (
    <div className="space-y-2">
      <NavLink
        to="/invoices"
        className={({ isActive }) =>
          `block rounded-xl px-4 py-3 font-medium ${
            isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
          }`
        }
      >
        Invoices
      </NavLink>

      <NavLink
        to="/resumes"
        className={({ isActive }) =>
          `block rounded-xl px-4 py-3 font-medium ${
            isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
          }`
        }
      >
        Resumes
      </NavLink>
    </div>
  );
};