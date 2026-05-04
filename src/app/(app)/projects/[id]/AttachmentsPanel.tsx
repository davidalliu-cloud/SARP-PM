import Link from "next/link";
import { createAttachment, deleteAttachment } from "@/app/actions";

type AttachmentRow = {
  id: string;
  category: string;
  label: string | null;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: Date;
  dailyRecord: { date: Date } | null;
  invoice: { invoiceNo: string | null; monthCovered: string } | null;
};

type DailyRecordOption = {
  id: string;
  date: Date;
};

type InvoiceOption = {
  id: string;
  invoiceNo: string | null;
  monthCovered: string;
};

function fileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function relatedLabel(attachment: AttachmentRow) {
  if (attachment.invoice) {
    return `Invoice ${attachment.invoice.invoiceNo || attachment.invoice.monthCovered}`;
  }
  if (attachment.dailyRecord) {
    return `Daily record ${attachment.dailyRecord.date.toLocaleDateString()}`;
  }
  return "Project file";
}

export function AttachmentsPanel({
  projectId,
  attachments,
  dailyRecords,
  invoices,
}: {
  projectId: string;
  attachments: AttachmentRow[];
  dailyRecords: DailyRecordOption[];
  invoices: InvoiceOption[];
}) {
  return (
    <div className="panel p-4">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase text-[#5b193f]">Documents</div>
          <h2 className="text-xl font-black">Receipts and attachments</h2>
        </div>
        <div className="text-sm font-bold text-[#6b7188]">{attachments.length} files</div>
      </div>

      <form action={createAttachment} className="grid gap-3 rounded-lg border border-[#d7e1e5] bg-[#f3f7f3] p-4 lg:grid-cols-2">
        <input type="hidden" name="projectId" value={projectId} />
        <label>
          File
          <input name="file" type="file" required />
        </label>
        <label>
          Category
          <select name="category" defaultValue="Receipt">
            <option value="Receipt">Receipt</option>
            <option value="Invoice">Invoice</option>
            <option value="Delivery note">Delivery note</option>
            <option value="Site photo">Site photo</option>
            <option value="Product purchase">Product purchase</option>
            <option value="Tool purchase">Tool purchase</option>
            <option value="Other">Other</option>
          </select>
        </label>
        <label>
          Link to daily record
          <select name="dailyRecordId" defaultValue="">
            <option value="">No daily record</option>
            {dailyRecords.map((record) => (
              <option key={record.id} value={record.id}>{record.date.toLocaleDateString()}</option>
            ))}
          </select>
        </label>
        <label>
          Link to invoice
          <select name="invoiceId" defaultValue="">
            <option value="">No invoice</option>
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>{invoice.invoiceNo || "Invoice"} / {invoice.monthCovered}</option>
            ))}
          </select>
        </label>
        <label className="lg:col-span-2">
          Note
          <input name="label" placeholder="Receipt for tools, delivery note, site photo description" />
        </label>
        <div className="flex items-center justify-between gap-3 lg:col-span-2">
          <div className="text-xs font-bold text-[#6b7188]">Maximum upload size: 8 MB per file.</div>
          <button className="btn btn-small btn-save" type="submit">Upload file</button>
        </div>
      </form>

      <div className="mt-4 grid gap-3">
        {attachments.map((attachment) => (
          <div key={attachment.id} className="rounded-lg border border-[#d7e1e5] bg-white p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="status status-finished">{attachment.category}</span>
                  <span className="text-xs font-bold text-[#6b7188]">{relatedLabel(attachment)}</span>
                </div>
                <div className="mt-2 truncate font-black text-[#373455]">{attachment.fileName}</div>
                <div className="mt-1 text-sm font-semibold text-[#6b7188]">
                  {fileSize(attachment.size)} / {attachment.createdAt.toLocaleDateString()}
                </div>
                {attachment.label ? <div className="mt-2 text-sm text-[#373455]">{attachment.label}</div> : null}
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Link href={`/api/attachments/${attachment.id}`} className="btn btn-small btn-edit">Download</Link>
                <form action={deleteAttachment}>
                  <input type="hidden" name="id" value={attachment.id} />
                  <input type="hidden" name="projectId" value={projectId} />
                  <button className="btn btn-small btn-delete" type="submit">Delete</button>
                </form>
              </div>
            </div>
          </div>
        ))}
        {!attachments.length ? (
          <div className="rounded-lg border border-dashed border-[#bdc8d0] bg-[#f3f7f3] p-4 text-sm font-bold text-[#6b7188]">
            No receipts or attachments uploaded for this project yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
