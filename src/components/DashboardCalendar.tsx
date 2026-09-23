import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, ArrowRight, MapPin, Clock3, Pencil } from "lucide-react";
import { Card, DivisionBadge } from "./UI";
import { TaskForm } from "./Forms";
import { useStore } from "../lib/store";
import { address, today } from "../lib/calculations";
import { calendarDay, monthDays, monthKey, nextMonth, entriesOn } from "../lib/dashboard-calendar";

export function DashboardCalendar({ newTask, navigate }: {
  newTask: () => void;
  navigate: (page: string) => void;
}) {
  const { data } = useStore();
  const currentDay = today();
  const [month, setMonth] = useState(() => monthKey(currentDay));
  const [selected, setSelected] = useState(() => currentDay);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingTask = data.tasks.find(t => t.id === editingId);
  const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const days = monthDays(month);
  const upcoming = entriesOn(data.tasks, selected);
  const count = data.tasks.filter(t => !t.done && monthKey(calendarDay(t.due_at)) === month).length;
  const monthLabel = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(month + "-01T12:00:00Z"));
  function changeMonth(step: number) {
    const next = nextMonth(month, step);
    setMonth(next);
    setSelected(next + "-01");
  }
  return <Card title="Dein Außendienst-Kalender" eyebrow="CRM-TERMINE · WIEDERVORLAGEN" className="nx-calendar-card"
    action={<button className="secondary" onClick={newTask}><Plus size={16}/> Termin</button>}>
    <div className="nx-calendar-layout">
      <div className="nx-calendar-main">
        <div className="nx-calendar-nav">
          <button type="button" className="icon-button" aria-label="Vorheriger Monat" onClick={() => changeMonth(-1)}><ChevronLeft size={20}/></button>
          <h3 aria-live="polite">{monthLabel}</h3>
          <button type="button" className="icon-button" aria-label="Nächster Monat" onClick={() => changeMonth(1)}><ChevronRight size={20}/></button>
          <button type="button" className="secondary nx-calendar-today" onClick={() => { setMonth(monthKey(currentDay));setSelected(currentDay); }}>Heute</button>
        </div>
        <div className="nx-calendar-grid" role="group" aria-label={"Kalender "+monthLabel}>
          {weekdays.map(w => <div className="nx-calendar-weekday" key={w}>{w}</div>)}
          {days.map((day,i) => {
            if (!day) return <div className="nx-calendar-empty" key={"empty-"+i} aria-hidden="true"/>;
            const entries = entriesOn(data.tasks,day);
            const meetings = entries.filter(t => t.kind === "Termin").length;
            const other = entries.length - meetings;
            const label = new Intl.DateTimeFormat("de-DE",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"})
              .format(new Date(day+"T12:00:00Z"));
            return <button type="button" key={day} aria-label={label+" · "+entries.length+" Einträge"}
              aria-pressed={selected===day}
              className={"nx-calendar-day"+(day===currentDay?" is-today":"")+(selected===day?" is-selected":"")}
              onClick={() => setSelected(day)}>
              <span>{Number(day.slice(-2))}</span>
              {entries.length>0&&<span className="nx-calendar-markers" aria-hidden="true">
                {meetings>0&&<i className="nx-calendar-dot meeting"/>}
                {other>0&&<i className="nx-calendar-dot followup"/>}
                {entries.length>2&&<small>{entries.length}</small>}
              </span>}
            </button>;
          })}
        </div>
        <div className="nx-calendar-legend">
          <span><i className="nx-calendar-dot meeting"/> Kundentermine</span>
          <span><i className="nx-calendar-dot followup"/> Aufgaben & Wiedervorlagen</span>
        </div>
      </div>
      <div className="nx-calendar-agenda">
        <div className="nx-calendar-agenda-head">
          <div><span className="eyebrow">AUSGEWÄHLTER TAG</span>
            <h3>{new Intl.DateTimeFormat("de-DE",{weekday:"long",day:"numeric",month:"long",timeZone:"UTC"})
              .format(new Date(selected+"T12:00:00Z"))}</h3>
          </div>
          <span className="nx-calendar-count">{upcoming.length}</span>
        </div>
        <div className="nx-calendar-agenda-rows">
          {upcoming.length ? upcoming.map(t => {
            const customer = data.customers.find(c => c.id===t.customer_id);
            const location = customer ? address(customer) : "";
            return <button type="button" className={"nx-calendar-entry"+(t.kind==="Termin"?" is-meeting":"")} key={t.id}
              onClick={() => setEditingId(t.id)} aria-label={t.title + " bearbeiten"}>
              <div className="nx-calendar-entry-time"><Clock3 size={14}/>
                {new Intl.DateTimeFormat("de-DE",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Berlin"}).format(new Date(t.due_at))}
                <span className="nx-calendar-kind">{t.kind||"Aufgabe"}</span>
              </div>
              <strong>{t.title}</strong>
              {customer&&<span className="nx-calendar-company">{customer.company}</span>}
              {location&&<small className="nx-calendar-address"><MapPin size={13}/>{location}</small>}
              {t.division&&<DivisionBadge division={t.division}/>}
              {t.notes&&<span className="nx-calendar-entry-notes">{t.notes}</span>}
              <span className="nx-calendar-edit"><Pencil size={14}/> Bearbeiten</span>
            </button>;
          }) : <div className="nx-calendar-no-entries"><CalendarDays size={26}/>
            <p>Für diesen Tag sind keine offenen Termine oder Wiedervorlagen geplant.</p>
            <button className="text-button" onClick={newTask}><Plus size={16}/> Termin erstellen</button>
          </div>}
        </div>
        <button className="card-footer" onClick={() => navigate("tasks")}>Alle Termine & Wiedervorlagen <ArrowRight size={16}/></button>
      </div>
    </div>
    <p className="hint nx-calendar-foot">Monatsübersicht aus deinen gespeicherten CRM-Einträgen · {count} offene Einträge im angezeigten Monat. Die noch nicht verbundene iCloud-Synchronisierung ist hierfür nicht erforderlich.</p>
    {editingTask && <TaskForm key={editingTask.id} task={editingTask} onClose={() => setEditingId(null)} />}
  </Card>;
}
