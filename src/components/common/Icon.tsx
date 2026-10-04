type IconName =
  | 'document'
  | 'user'
  | 'users'
  | 'items'
  | 'palette'
  | 'image'
  | 'pen'
  | 'list'
  | 'importExport'
  | 'plus'
  | 'copy'
  | 'trash'
  | 'eye'
  | 'download'
  | 'check';

type Props = {
  name: IconName;
  className?: string;
};

const paths: Record<IconName, string> = {
  document:
    'M7 3.5h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z M14 3.5v4h4 M9 12.5h6 M9 15.5h6 M9 9.5h2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4.5 20.5a7.5 7.5 0 0 1 15 0',
  users:
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M3.5 20a5.5 5.5 0 0 1 11 0 M17 11a3 3 0 1 0 0-6 M16 14.2c2.6.3 4.5 1.9 4.5 5.8',
  items:
    'M4 7l8-3.5L20 7v10l-8 3.5L4 17V7Z M4 7l8 3.5 8-3.5 M12 10.5V21',
  palette:
    'M12 3.5a8.5 8.5 0 1 0 0 17c1 0 1.6-.7 1.6-1.5 0-.4-.2-.7-.4-1-.2-.3-.4-.6-.4-1 0-.8.6-1.5 1.5-1.5H16a4.5 4.5 0 0 0 4.5-4.5c0-4.4-3.8-8-8.5-8Z M7.5 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z M8.5 8.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z M12.5 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z M16 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  image:
    'M4.5 5.5h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z M8.2 10.7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z M20.5 16.5l-5.4-5.4a1 1 0 0 0-1.4 0L6.5 18.5',
  pen: 'M4 20l.9-3.6L16 5.3a1.8 1.8 0 0 1 2.6 0l1.1 1.1a1.8 1.8 0 0 1 0 2.6L8.6 20.1 4 20Z M14.3 7l2.7 2.7',
  list: 'M8 6.5h12 M8 12h12 M8 17.5h12 M4 6.5h.01 M4 12h.01 M4 17.5h.01',
  importExport: 'M8 6.5l-3.5 3.5L8 13.5 M4.5 10h9 M16 10.5l3.5 3.5-3.5 3.5 M20 14h-9',
  plus: 'M12 5v14 M5 12h14',
  copy: 'M9 9h9.5a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1Z M5.5 15.5h-1a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1H14a1 1 0 0 1 1 1v1',
  trash:
    'M4.5 7h15 M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2 M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13 M10 11v6 M14 11v6',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  download: 'M12 4v11.5 M7.5 11l4.5 4.5 4.5-4.5 M5 19.5h14',
  check: 'M5 13l4.5 4.5L19.5 7'
};

export const Icon = ({ name, className = 'h-4 w-4' }: Props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {paths[name].split(' M').map((segment, i) => (
      <path key={i} d={i === 0 ? segment : `M${segment}`} />
    ))}
  </svg>
);
