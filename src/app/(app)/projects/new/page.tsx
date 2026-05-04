import { createProject } from "@/app/actions";
import { PageTitle } from "@/components/PageTitle";
import { dateInputValue } from "@/lib/format";

export default function NewProjectPage() {
  return (
    <>
      <PageTitle eyebrow="Create" title="New project" />
      <form action={createProject} className="panel grid max-w-3xl gap-4 p-5 md:grid-cols-2">
        <label>
          Project name
          <input name="name" required placeholder="Riverside Pump Station" />
        </label>
        <label>
          Client name
          <input name="clientName" placeholder="Client, optional" />
        </label>
        <label>
          Start date
          <input name="startDate" type="date" required defaultValue={dateInputValue()} />
        </label>
        <label>
          Project budget / contract value
          <input name="budgetAmount" type="number" min="0" step="0.01" placeholder="50000.00" />
        </label>
        <label>
          Status
          <select name="status" required defaultValue="NOT_STARTED">
            <option value="NOT_STARTED">Not Started</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="FINISHED">Finished</option>
          </select>
        </label>
        <div className="md:col-span-2">
          <button className="btn btn-primary" type="submit">Create project</button>
        </div>
      </form>
    </>
  );
}
