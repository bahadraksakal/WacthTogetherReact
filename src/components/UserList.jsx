import React from "react";

function UserList({ users }) {
  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold mb-2">Bağlı Kullanıcılar</h4>
      <ul className="space-y-1">
        {users.map((user, index) => (
          <li key={index} className="text-xs truncate">
            🟢 {user.username}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default UserList;
