import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function UploadDocs() {
  const navigate = useNavigate()
  const [cacDoc, setCacDoc] = useState<File | null>(null)
  const [idDoc, setIdDoc] = useState<File | null>(null)

  const handleSubmit = () => {
    // TODO: Upload to Supabase Storage
    navigate('/pending-approval')
  }

  const boxStyle = {
    border: '2px dashed #f97316',
    borderRadius: '12px',
    padding: '24px',
    textAlign: 'center' as const,
    marginBottom: '16px',
    cursor: 'pointer'
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: 'white',
        borderRadius: '20px',
        padding: '32px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>📄</div>
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#f97316' }}>
            Upload Documents
          </h1>
          <p style={{ color: '#666', fontSize: '13px', marginTop: '4px' }}>
            Help us verify your company
          </p>
        </div>

        <label style={boxStyle}>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setCacDoc(e.target.files?.[0] || null)}
            style={{ display: 'none' }}
          />
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
          <p style={{ fontWeight: 'bold', fontSize: '14px' }}>CAC Certificate</p>
          <p style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
            {cacDoc ? cacDoc.name : 'Tap to upload'}
          </p>
        </label>

        <label style={boxStyle}>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setIdDoc(e.target.files?.[0] || null)}
            style={{ display: 'none' }}
          />
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🆔</div>
          <p style={{ fontWeight: 'bold', fontSize: '14px' }}>Valid ID (Owner)</p>
          <p style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
            {idDoc ? idDoc.name : 'Tap to upload'}
          </p>
        </label>

        <button
          onClick={handleSubmit}
          disabled={!cacDoc || !idDoc}
          style={{
            width: '100%',
            padding: '14px',
            background: (!cacDoc || !idDoc) ? '#94a3b8' : '#f97316',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: (!cacDoc || !idDoc) ? 'not-allowed' : 'pointer',
            marginTop: '8px'
          }}>
          ✅ Submit for Review
        </button>
      </div>
    </div>
  )
}

export default UploadDocs