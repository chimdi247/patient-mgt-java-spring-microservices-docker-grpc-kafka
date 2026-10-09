import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { PatientFormDialog } from "@/components/PatientFormDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ageOf, formatDate, initials } from "@/lib/format";
import { useFetch } from "@/lib/hooks";
import type { Patient } from "@/lib/types";

const SIZE = 10;
const SORTS: Record<string, (a: Patient, b: Patient) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  newest: (a, b) => (b.registeredDate ?? "").localeCompare(a.registeredDate ?? ""),
  oldest: (a, b) => (a.registeredDate ?? "").localeCompare(b.registeredDate ?? ""),
  youngest: (a, b) => b.dateOfBirth.localeCompare(a.dateOfBirth),
};

export default function Patients() {
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload } = useFetch(() => api.listPatients());
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(0);
  const [form, setForm] = useState<{ open: boolean; patient: Patient | null }>({ open: false, patient: null });
  const [toDelete, setToDelete] = useState<Patient | null>(null);
  const [deleting, setDeleting] = useState(false);

  // /patients?new=1 (from the dashboard) opens the registration dialog
  useEffect(() => {
    if (params.get("new")) {
      setForm({ open: true, patient: null });
      params.delete("new");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? [])
      .filter((p) => !term || [p.name, p.email, p.address].some((v) => v.toLowerCase().includes(term)))
      .sort(SORTS[sort]);
  }, [data, q, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / SIZE));
  const rows = filtered.slice(page * SIZE, page * SIZE + SIZE);
  useEffect(() => { if (page >= pages) setPage(0); }, [page, pages]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.deletePatient(toDelete.id);
      toast.success(`${toDelete.name} deleted`);
      setToDelete(null);
      void reload(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the patient");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader title="Patients" description="Search, register and maintain patient records." actions={
        <Button variant="accent" onClick={() => setForm({ open: true, patient: null })}><Plus />Register patient</Button>} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, email or address" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="Search patients" />
        </div>
        <div className="w-52">
          <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort patients">
            <option value="name">Name (A to Z)</option>
            <option value="newest">Newest registered</option>
            <option value="oldest">Oldest registered</option>
            <option value="youngest">Youngest first</option>
          </Select>
        </div>
      </div>

      {error && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead className="hidden md:table-cell">Address</TableHead>
              <TableHead className="hidden sm:table-cell">Age</TableHead>
              <TableHead className="hidden lg:table-cell">Registered</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? [0, 1, 2, 3, 4].map((i) => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-9" /></TableCell></TableRow>)
              : rows.length === 0 ? (
                <TableRow><TableCell colSpan={5}>
                  <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                    <Users className="h-8 w-8" />
                    <p className="text-sm">{q ? "No patients match your search." : "No patients yet."}</p>
                  </div>
                </TableCell></TableRow>
              ) : rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary">{initials(p.name)}</span>
                      <div className="min-w-0"><p className="truncate font-semibold">{p.name}</p><p className="truncate text-xs text-muted-foreground">{p.email}</p></div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{p.address}</TableCell>
                  <TableCell className="tnum hidden sm:table-cell">{ageOf(p.dateOfBirth)}</TableCell>
                  <TableCell className="tnum hidden text-muted-foreground lg:table-cell">{formatDate(p.registeredDate)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setForm({ open: true, patient: p })} aria-label={`Edit ${p.name}`}><Pencil /></Button>
                    {isAdmin && (
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setToDelete(p)} aria-label={`Delete ${p.name}`}><Trash2 /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <Pagination page={page} pages={pages} total={filtered.length} onChange={setPage} />
      </Card>

      <PatientFormDialog open={form.open} patient={form.patient} onClose={() => setForm({ open: false, patient: null })} onSaved={() => void reload(true)} />

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && !deleting && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this patient?</DialogTitle>
            <DialogDescription>{toDelete?.name} ({toDelete?.email}) will be permanently removed. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" loading={deleting} onClick={confirmDelete}><Trash2 />Delete patient</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
