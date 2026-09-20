import { useStore } from "../lib/store";
import { Modal, AsyncForm, Field, value } from "./UI";
import { today } from "../lib/calculations";
import type { Customer, Task, Division } from "../lib/types";
import { appointmentTime, berlinDateTime } from "../lib/appointments";
export function CustomerForm({
  customer,
  division,
  onClose,
}: {
  customer?: Customer;
  division?: Division;
  onClose: () => void;
}) {
  const { save, refresh } = useStore();
  return (
    <Modal
      title={customer ? "Kundenakte bearbeiten" : "Neuen Standort erfassen"}
      onClose={onClose}
    >
      <AsyncForm
        onSubmit={async (f) => {
          await save("customers", {
            ...customer,
            company: value(f, "company"),
            contact: value(f, "contact"),
            email: value(f, "email"),
            phone: value(f, "phone"),
            street: value(f, "street"),
            zip: value(f, "zip"),
            city: value(f, "city"),
            industry: value(f, "industry"),
            source: customer?.source || "Manuell",
            notes: value(f, "notes"),
            lat: customer?.lat ?? null,
            lng: customer?.lng ?? null,
            ...(!customer
              ? {
                  interests:
                    value(f, "interest") === "both"
                      ? (["sumup", "vape"] as Division[])
                      : [value(f, "interest") as Division],
                }
              : {}),
          });
          await refresh();
          onClose();
        }}
      >
        <div className="form-grid">
          <Field label="Unternehmen *">
            <input
              name="company"
              required
              maxLength={200}
              defaultValue={customer?.company}
            />
          </Field>
          <Field label="Ansprechpartner">
            <input
              name="contact"
              maxLength={160}
              defaultValue={customer?.contact}
            />
          </Field>
          <Field label="E-Mail">
            <input
              name="email"
              type="email"
              maxLength={254}
              defaultValue={customer?.email}
            />
          </Field>
          <Field label="Telefon">
            <input
              name="phone"
              type="tel"
              maxLength={40}
              defaultValue={customer?.phone}
            />
          </Field>
          <Field label="Straße / Hausnummer">
            <input
              name="street"
              maxLength={200}
              defaultValue={customer?.street}
            />
          </Field>
          <Field label="PLZ">
            <input name="zip" maxLength={12} defaultValue={customer?.zip} />
          </Field>
          <Field label="Ort *">
            <input
              name="city"
              required
              maxLength={120}
              defaultValue={customer?.city}
            />
          </Field>
          <Field label="Branche">
            <input
              name="industry"
              maxLength={100}
              defaultValue={customer?.industry}
            />
          </Field>
          {!customer && (
            <Field label="Vertriebsbereich">
              <select name="interest" defaultValue={division || "sumup"}>
                <option value="sumup">SumUp</option>
                <option value="vape">Händlerverwaltung</option>
                <option value="both">Beide Bereiche</option>
              </select>
            </Field>
          )}
        </div>
        <Field label="Notizen">
          <textarea
            name="notes"
            maxLength={5000}
            defaultValue={customer?.notes}
          />
        </Field>
      </AsyncForm>
    </Modal>
  );
}
export function TaskForm({
  task,
  customerId,
  division,
  onClose,
}: {
  task?: Task;
  customerId?: string;
  division?: Division;
  onClose: () => void;
}) {
  const { data, save } = useStore();
  return (
    <Modal
      title={task ? "Aufgabe bearbeiten" : "Nächsten Schritt planen"}
      onClose={onClose}
    >
      <AsyncForm
        onSubmit={async (f) => {
          await save("tasks", {
            ...task,
            title: value(f, "title"),
            customer_id: value(f, "customer_id") || null,
            division: (value(f, "division") || null) as Division | null,
            due_at: appointmentTime(value(f, "due_at")),
            kind: value(f, "kind") as Task["kind"],
            notes: value(f, "notes"),
            done: task?.done ?? false,
          });
          onClose();
        }}
      >
        <Field label="Art des Eintrags">
          <select name="kind" defaultValue={task?.kind || "Wiedervorlage"}>
            <option>Wiedervorlage</option>
            <option>Termin</option>
            <option>Aufgabe</option>
          </select>
        </Field>
        <Field label="Was steht an? *">
          <input
            name="title"
            required
            maxLength={240}
            defaultValue={task?.title}
            placeholder="Zum Beispiel: Ansprechpartner zurückrufen"
          />
        </Field>
        <div className="form-grid">
          <Field label="Kunde">
            <select
              name="customer_id"
              defaultValue={task?.customer_id || customerId || ""}
            >
              <option value="">Ohne Kundenbezug</option>
              {data.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Bereich">
            <select
              name="division"
              defaultValue={task?.division || division || ""}
            >
              <option value="">Zentral</option>
              <option value="sumup">SumUp</option>
              <option value="vape">Händlerverwaltung</option>
            </select>
          </Field>
          <Field label="Fällig am * (deutsche Ortszeit)">
            <input
              name="due_at"
              type="datetime-local"
              required
              defaultValue={
                task ? berlinDateTime(task.due_at) : today() + "T10:00"
              }
            />
          </Field>
        </div>
        <Field label="Termin- / Aufgabenhinweise">
          <textarea
            name="notes"
            maxLength={3000}
            defaultValue={task?.notes || ""}
          />
        </Field>
      </AsyncForm>
    </Modal>
  );
}
