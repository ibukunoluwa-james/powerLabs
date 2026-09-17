import Link from 'next/link';
import { TaskForm } from '@/components/TaskForm';

export const metadata = { title: 'New task · Task Manager' };

export default function NewTaskPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900 hover:underline">
          ← Back to tasks
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New task</h1>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <TaskForm />
      </div>
    </div>
  );
}
