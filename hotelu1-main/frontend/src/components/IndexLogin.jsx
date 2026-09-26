// IndexLogin has been deprecated. The app uses `Login.jsx` for /login.
import React from 'react';

const IndexLogin = () => {
  return null; // placeholder to avoid accidental imports — file can be removed
};
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
              placeholder="Enter username"
              required
              disabled={loading}
            />
          </div>
          
          <div className="mb-6">
            <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
              placeholder="Enter password"
              required
              disabled={loading}
            />
          </div>
          
          {error && <p className="text-red-500 text-sm italic mb-4 text-center bg-red-50 p-2 rounded">{error}</p>}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary mt-4"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* Demo Credentials */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm font-semibold text-gray-700 mb-3">Demo Credentials:</p>
          <ul className="text-xs text-gray-600 space-y-1">
            <li><strong>Admin:</strong> admin / admin</li>
            <li><strong>Manager:</strong> manager1 / pass</li>
            <li><strong>Waiter:</strong> waiter1 / pass</li>
            <li><strong>Franchise:</strong> franchise1 / pass</li>
          </ul>
        </div>

        {/* Back to Home */}
        <div className="mt-6 text-center">
          <a 
            href="/" 
            className="text-orange-600 hover:text-orange-700 text-sm font-semibold"
          >
            ← Back to Restaurant
          </a>
        </div>
      </div>
    </div>
  );
};

export default IndexLogin;
