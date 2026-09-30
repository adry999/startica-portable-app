import styles from './NoteList.module.css';

export interface NoteListItem {
  key: string;
  author: string;
  /** Ex. "12 septembrie 2026". */
  date: string;
  text: string;
}

export interface NoteListProps {
  notes: NoteListItem[];
  className?: string;
}

/** Note libere cu autor și dată (COMPONENTE.md §2) — cea mai recentă evidențiată. Golul e responsabilitatea apelantului (R9). */
export function NoteList({ notes, className }: NoteListProps) {
  const classes = className ? `${styles.list} ${className}` : styles.list;
  return (
    <ul className={classes}>
      {notes.map((note, index) => (
        <li key={note.key} className={index === 0 ? `${styles.note} ${styles.latest}` : styles.note}>
          <span className={styles.meta}>
            <strong>{note.author}</strong> · {note.date}
          </span>
          <p className={styles.text}>{note.text}</p>
        </li>
      ))}
    </ul>
  );
}
