const { useState, useEffect, useRef } = React;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function StarPicker({ value, onChange }) {
  return (
    <div className="star-picker">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={n <= value ? "on" : ""}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function StarDisplay({ value }) {
  return (
    <div className="card-stars">
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className={n <= value ? "s-on" : "s-off"}>★</span>
      ))}
    </div>
  );
}

function Toast({ message }) {
  return <div className="toast">{message}</div>;
}

// ─── Add Movie Modal ───────────────────────────────────────────────────────────

const GENRES = [
  "Action", "Adventure", "Animation", "Comedy", "Crime",
  "Documentary", "Drama", "Fantasy", "Horror", "Mystery",
  "Romance", "Sci-Fi", "Thriller", "Western"
];

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function AddMovieModal({ onClose, onSave }) {
  const [title, setTitle]       = useState("");
  const [poster, setPoster]     = useState(null);
  const [rating, setRating]     = useState(0);
  const [notes, setNotes]       = useState("");
  const [genre, setGenre]       = useState("");
  const [watchedDate, setWatchedDate] = useState(todayStr());
  const [saving, setSaving]     = useState(false);
  const fileRef = useRef();

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPoster(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({
      title: title.trim(),
      poster: poster || null,
      rating,
      notes: notes.trim(),
      genre,
      watchedDate
    });
    setSaving(false);
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Add a Title</h2>

        <div className="field">
          <label>Title</label>
          <input
            type="text"
            placeholder="e.g. Interstellar"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        <div className="field">
          <label>Poster</label>
          <div className="upload-zone">
            <input type="file" accept="image/*" onChange={handleFile} ref={fileRef} />
            {poster
              ? <img src={poster} alt="preview" className="poster-preview" />
              : <p>Click to upload an image</p>
            }
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Genre</label>
            <select className="genre-select" value={genre} onChange={e => setGenre(e.target.value)}>
              <option value="">— Select —</option>
              {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Date Watched</label>
            <input
              type="date"
              className="date-input"
              value={watchedDate}
              onChange={e => setWatchedDate(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label>Rating</label>
          <StarPicker value={rating} onChange={setRating} />
        </div>

        <div className="field">
          <label>Notes</label>
          <textarea
            placeholder="Your thoughts..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="btn-save"
            onClick={handleSave}
            disabled={!title.trim() || saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Movie Card ────────────────────────────────────────────────────────────────

function MovieCard({ movie, onDelete }) {
  const displayDate = movie.watchedDate
    ? new Date(movie.watchedDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div className="card">
      {movie.poster
        ? <img src={movie.poster} alt={movie.title} className="card-poster" />
        : <div className="card-poster-placeholder">🎬<span>No Poster</span></div>
      }
      <div className="card-overlay">
        <div className="card-title">{movie.title}</div>
        {movie.genre && <div className="card-genre">{movie.genre}</div>}
        <StarDisplay value={movie.rating} />
        {movie.notes && <div className="card-notes">{movie.notes}</div>}
        {displayDate && <div className="card-date">Watched {displayDate}</div>}
        <button className="card-delete" onClick={() => onDelete(movie.id)}>Remove</button>
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────

function App() {
  const [movies, setMovies]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch]   = useState("");
  const [sort, setSort]       = useState("newest");
  const [toast, setToast]     = useState(null);

  const fb = window.__firebase;

  // ── Load from Firestore ──
  async function loadMovies() {
    try {
      setError(null);
      const snap = await fb.getDocs(fb.collection(fb.db, "movies"));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMovies(data);
    } catch (err) {
      setError("Could not load movies. Check your Firebase config.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadMovies(); }, []);

  // ── Save to Firestore ──
  async function handleSave(movie) {
    try {
      const ref = await fb.addDoc(fb.collection(fb.db, "movies"), {
        ...movie,
        createdAt: Date.now()
      });
      setMovies(prev => [{ id: ref.id, ...movie, createdAt: Date.now() }, ...prev]);
      setShowForm(false);
      showToast("Movie added ✓");
    } catch (err) {
      setError("Failed to save. Check your Firebase config.");
      console.error(err);
    }
  }

  // ── Delete from Firestore ──
  async function handleDelete(id) {
    try {
      await fb.deleteDoc(fb.doc(fb.db, "movies", id));
      setMovies(prev => prev.filter(m => m.id !== id));
      showToast("Removed");
    } catch (err) {
      setError("Failed to delete.");
      console.error(err);
    }
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  // ── Filter & Sort ──
  const filtered = movies
    .filter(m => m.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "rating-high") return b.rating - a.rating;
      if (sort === "rating-low")  return a.rating - b.rating;
      if (sort === "title")       return a.title.localeCompare(b.title);
      return b.createdAt - a.createdAt; // newest
    });

  return (
    <>
      <header>
        <div className="logo">Letterbox</div>
        <span className="movie-count">{movies.length} title{movies.length !== 1 ? "s" : ""}</span>
      </header>

      <div className="hero">
        <div className="hero-title">Watched List</div>
        <div className="hero-sub">Personal movie collection</div>
        <div className="controls">
          <div className="search-wrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search titles…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="rating-high">Rating: high → low</option>
            <option value="rating-low">Rating: low → high</option>
            <option value="title">Title A–Z</option>
          </select>
          <button className="btn-add" onClick={() => setShowForm(true)}>+ Add Title</button>
        </div>
      </div>

      <main className="app-body">
        {error && <div className="error-banner">{error}</div>}

        {loading ? (
          <div className="loading">Loading your titles…</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🎬</div>
            <h3>{search ? "No results found" : "Your watchlist is empty"}</h3>
            <p>{search ? "Try a different title." : "Add your first film to get started."}</p>
          </div>
        ) : (
          <>
            <div className="section-label">All Titles</div>
            <div className="grid">
              {filtered.map(m => (
                <MovieCard key={m.id} movie={m} onDelete={handleDelete} />
              ))}
            </div>
          </>
        )}
      </main>

      {showForm && (
        <AddMovieModal onClose={() => setShowForm(false)} onSave={handleSave} />
      )}

      {toast && <Toast message={toast} />}
    </>
  );
}

// ─── Mount ─────────────────────────────────────────────────────────────────────

// Wait for Firebase module to initialise before mounting
function waitForFirebase(cb, tries = 0) {
  if (window.__firebase) return cb();
  if (tries > 20) return console.error("Firebase failed to load.");
  setTimeout(() => waitForFirebase(cb, tries + 1), 150);
}

waitForFirebase(() => {
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(React.createElement(App));
});
