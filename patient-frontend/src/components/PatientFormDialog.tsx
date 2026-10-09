import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { todayISO } from "@/lib/format";
import type { Patient, PatientInput } from "@/lib/types";

const empty = (): PatientInput => ({ name: "", email: "", address: "", dateOfBirth: "", registeredDate: todayISO() });

/** Create (patient === null) or edit a patient. */
export function PatientFormDialog({ open, patient, onClose, onSaved }: { open: boolean; patient: Patient | null; onClose: () => void; onSaved: () => void }) {
  const editing = !!patient;
  const [form, setForm] = useState<PatientInput>(empty());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(patient ? { name: patient.name, email: patient.email, address: patient.address, dateOfBirth: patient.dateOfBirth, registeredDate: patient.registeredDate } : empty());
  }, [open, patient]);

  const set = (k: keyof PatientInput) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: PatientInput = { name: form.name.trim(), email: form.email.trim(), address: form.address.trim(), dateOfBirth: form.dateOfBirth };
      if (editing) {
        await api.updatePatient(patient!.id, body);
        toast.success(`${body.name} updated`);
      } else {
        await api.createPatient({ ...body, registeredDate: form.registeredDate || todayISO() });
        toast.success(`${body.name} registered`, { description: "A billing account was opened and the event was published to Kafka." });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the patient");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit patient" : "Register patient"}</DialogTitle>
          <DialogDescription>{editing ? "Update the patient's details." : "A billing account is opened automatically."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="p-name">Full name</Label><Input id="p-name" required maxLength={100} value={form.name} onChange={set("name")} autoFocus /></div>
          <div className="space-y-2"><Label htmlFor="p-email">Email</Label><Input id="p-email" type="email" required value={form.email} onChange={set("email")} /></div>
          <div className="space-y-2"><Label htmlFor="p-address">Address</Label><Input id="p-address" required value={form.address} onChange={set("address")} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="p-dob">Date of birth</Label><Input id="p-dob" type="date" required max={todayISO()} value={form.dateOfBirth} onChange={set("dateOfBirth")} /></div>
            <div className="space-y-2">
              <Label htmlFor="p-reg">Registered on</Label>
              <Input id="p-reg" type="date" required disabled={editing} value={form.registeredDate ?? ""} onChange={set("registeredDate")} />
            </div>
          </div>
          {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" loading={busy}>{editing ? "Save changes" : "Register patient"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
