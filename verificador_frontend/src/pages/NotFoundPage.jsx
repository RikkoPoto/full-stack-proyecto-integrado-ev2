import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useMisc.js';
import { EmptyState } from '../components/ui/States.jsx';

export default function NotFoundPage() {
  useDocumentTitle('Página no encontrada');
  return (
    <EmptyState title="Página no encontrada" action={<Link to="/" className="btn btn-primary">Ir al inicio</Link>}>
      La dirección que abriste no existe o fue movida.
    </EmptyState>
  );
}
