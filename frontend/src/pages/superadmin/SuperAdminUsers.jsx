import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { superadmin } from '../../api';
import './SuperAdminUsers.css';

const DEBOUNCE_MS = 350;

export default function SuperAdminUsers() {
  const [list, setList] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setLoading(true);
    superadmin
      .listUsers(search ? { search } : {})
      .then(({ data }) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="superadmin-users-page">
      <div className="superadmin-users-header">
        <h1>User management</h1>
        <p className="superadmin-users-sub">Search by name or email. Change roles or create new users.</p>
        <div className="superadmin-users-toolbar">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="superadmin-users-search"
          />
          <Link to="/superadmin/users/create" className="superadmin-users-create-btn">Create user</Link>
        </div>
      </div>
      {loading ? (
        <div className="superadmin-users-loading">Loading users...</div>
      ) : (
        <div className="superadmin-users-table-wrap">
          <table className="superadmin-users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Active</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={6} className="superadmin-users-empty">No users found.</td>
                </tr>
              ) : (
                list.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td><span className={`superadmin-role superadmin-role-${(u.role || '').toLowerCase().replace('_', '-')}`}>{u.role}</span></td>
                    <td>{u.is_active ? 'Yes' : 'No'}</td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td><Link to={`/superadmin/users/${u.id}`} className="superadmin-users-edit-link">Edit</Link></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
