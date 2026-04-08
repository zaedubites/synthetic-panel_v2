import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import authService from '../services/authApi'

export default function SelectOrganization() {
  const { token, selectOrganization, logout } = useAuth()
  const [organizations, setOrganizations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const res = await authService.organizations(token)
        const orgs = res.data.organizations || res.data || []
        setOrganizations(Array.isArray(orgs) ? orgs : [orgs])
      } catch (err) {
        setError('Failed to load organizations.')
      } finally {
        setIsLoading(false)
      }
    }
    fetchOrgs()
  }, [token])

  // If only one org, auto-select it
  useEffect(() => {
    if (organizations.length === 1) {
      selectOrganization(organizations[0])
    }
  }, [organizations, selectOrganization])

  if (isLoading || organizations.length === 1) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Select Organization</h1>
          <p className="text-sm text-gray-500 mt-1">Choose an organization to continue</p>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 rounded-md border border-red-200 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => selectOrganization(org)}
              className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-primary hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-gray-900">{org.name}</div>
              {org.subdomain && (
                <div className="text-sm text-gray-500">{org.subdomain}</div>
              )}
            </button>
          ))}
        </div>

        {organizations.length === 0 && !error && (
          <p className="text-center text-gray-500">No organizations found.</p>
        )}

        <button
          onClick={logout}
          className="w-full mt-4 py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
