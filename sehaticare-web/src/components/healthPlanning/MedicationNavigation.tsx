import { NavLink, Outlet } from 'react-router-dom';
import { buttonClassName } from '../ui/button';

const medicationSections = [
  { label: 'Kelola Pengingat', path: '/patient/medication-reminders' },
  { label: 'Ubah Pengingat', path: '/patient/medication-reminders/edit' },
  { label: 'Riwayat Respons', path: '/patient/adherence' }
];

export function MedicationNavigation() {
  return (
    <nav aria-label="Bagian pengingat dan kepatuhan" className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2">
      {medicationSections.map((section) => (
        <NavLink
          key={section.path}
          to={section.path}
          end
          className={({ isActive }) => buttonClassName({ variant: isActive ? 'default' : 'ghost', size: 'sm' })}
        >
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function MedicationSectionLayout() {
  return (
    <div className="space-y-6">
      <MedicationNavigation />
      <Outlet />
    </div>
  );
}
