import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';
import { Button, EmptyState } from './_shared';

export function NotFound() {
  return (
    <div className="max-w-md mx-auto mt-16">
      <EmptyState icon={<Compass size={22} />} title="Page not found"
        hint="This route does not exist in your vault. Head back to the dashboard."
        action={<Link to="/"><Button variant="primary"><ArrowLeft size={14} />Back to Dashboard</Button></Link>} />
    </div>
  );
}
