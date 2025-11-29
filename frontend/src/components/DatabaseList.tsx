import type { DatabaseSummary } from './DataVaultApp';

type DatabaseListProps = {
  databases: DatabaseSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export function DatabaseList({ databases, selectedId, onSelect }: DatabaseListProps) {
  if (!databases.length) {
    return (
      <div className="card list-card">
        <h3>Your databases</h3>
        <p className="muted">Create a database to start storing encrypted numbers.</p>
      </div>
    );
  }

  return (
    <div className="card list-card">
      <div className="list-header">
        <div>
          <p className="eyebrow">Databases</p>
          <h3>Secure collections</h3>
        </div>
        <p className="muted">{databases.length} registered</p>
      </div>
      <div className="list">
        {databases.map((db) => (
          <button
            key={db.id}
            type="button"
            className={`list-item ${selectedId === db.id ? 'active' : ''}`}
            onClick={() => onSelect(db.id)}
          >
            <div>
              <h4>{db.name}</h4>
              <p className="muted">
                {new Date(db.createdAt * 1000).toLocaleString()} • {db.encryptedValueCount} values
              </p>
            </div>
            <span className="badge">#{db.id}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
