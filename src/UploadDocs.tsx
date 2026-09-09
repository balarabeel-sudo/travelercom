import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#F97316',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16a34a',
  red: '#dc2626',
}

function UploadDocs() {
  const navigate = useNavigate()
  const [cacDoc, setCacDoc] = useState<File | null>(null)
  const [idDoc, setIdDoc] = useState<File | null>(null)
  const [cacNumber, setCacNumber] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const allFilled = cacDoc && idDoc && cacNumber.trim() && licenseNumber.trim() && businessAddress.trim()

  const uploadOne = async (file: File, userId: string, label: string) => {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${userId}/${label}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('verification-docs').upload(path, file, { upsert: false })
    if (upErr) throw upErr
    return path
  }

  const handleSubmit = async () => {
    if (!allFilled || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser()
      if (userErr || !userData.user) throw new Error('Not signed in')
      const userId = userData.user.id

      const { data: company, error: companyErr } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', userId)
        .maybeSingle()
      if (companyErr || !company) throw new Error('We could not find your company record. Please contact support.')

      const cacPath = await uploadOne(cacDoc as File, userId, 'cac')
      const idPath = await uploadOne(idDoc as File, userId, 'id')

      const { error: docsErr } = await supabase.from('documents').insert([
        { user_id: userId, document_type: 'cac_certificate', file_url: cacPath, verification_status: 'pending' },
        { user_id: userId, document_type: 'government_id', file_url: idPath, verification_status: 'pending' },
      ])
      if (docsErr) throw docsErr

      const { error: companyUpdateErr } = await supabase
        .from('companies')
        .update({
          cac_number: cacNumber.trim(),
          license_number: licenseNumber.trim(),
          business_address: businessAddress.trim(),
          verification_status: 'pending',
          approval_status: 'pending',
        })
        .eq('id', company.id)
      if (companyUpdateErr) throw companyUpdateErr

      const { error: approvalErr } = await supabase.from('pending_approvals').insert({
        request_type: 'company_verification',
        request_id: company.id,
        submitted_by: userId,
        status: 'pending',
      })
      if (approvalErr) throw approvalErr

      navigate('/pending-approval')
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  const boxStyle = {
    border: `2px dashed ${COLORS.secondary}`,
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center' as const,
    marginBottom: '14px',
    cursor: 'pointer',
  }

  const inputStyle = {
    width: '100%',
    padding: '13px 14px',
    border: `1.5px solid ${COLORS.border}`,
    borderRadius: '10px',
    fontSize: '14px',
    color: COLORS.text,
    marginBottom: '14px',
    boxSizing: 'border-box' as const,
    outline: 'none',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: COLORS.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: COLORS.card,
        borderRadius: '20px',
        padding: '28px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
            <Icon name="clipboard" size={38} color={COLORS.secondary} />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: COLORS.secondary }}>
            Verify Your Company
          </h1>
          <p style={{ color: COLORS.textMuted, fontSize: '13px', marginTop: '4px' }}>
            We need these details before you can start operating
          </p>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px', marginBottom: '14px' }}>
            <p style={{ fontSize: '12.5px', color: COLORS.red }}>{error}</p>
          </div>
        )}

        <label style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '6px', display: 'block' }}>CAC Registration Number</label>
        <input
          type="text"
          placeholder="e.g. RC1234567"
          value={cacNumber}
          onChange={(e) => setCacNumber(e.target.value)}
          style={inputStyle}
        />

        <label style={boxStyle}>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setCacDoc(e.target.files?.[0] || null)}
            style={{ display: 'none' }}
          />
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>
            <Icon name="clipboard" size={26} color={COLORS.secondary} />
          </div>
          <p style={{ fontWeight: 700, fontSize: '13.5px', color: COLORS.text }}>CAC Certificate</p>
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '3px' }}>
            {cacDoc ? cacDoc.name : 'Tap to upload'}
          </p>
        </label>

        <label style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '6px', display: 'block' }}>Business License Number</label>
        <input
          type="text"
          placeholder="e.g. license or permit number"
          value={licenseNumber}
          onChange={(e) => setLicenseNumber(e.target.value)}
          style={inputStyle}
        />

        <label style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, marginBottom: '6px', display: 'block' }}>Business Address / Location</label>
        <input
          type="text"
          placeholder="Full business address"
          value={businessAddress}
          onChange={(e) => setBusinessAddress(e.target.value)}
          style={inputStyle}
        />

        <label style={boxStyle}>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setIdDoc(e.target.files?.[0] || null)}
            style={{ display: 'none' }}
          />
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>
            <Icon name="user" size={26} color={COLORS.secondary} />
          </div>
          <p style={{ fontWeight: 700, fontSize: '13.5px', color: COLORS.text }}>Valid Government ID (Owner)</p>
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '3px' }}>
            {idDoc ? idDoc.name : 'Tap to upload'}
          </p>
        </label>

        <button
          onClick={handleSubmit}
          disabled={!allFilled || submitting}
          style={{
            width: '100%',
            padding: '14px',
            background: (!allFilled || submitting) ? '#94a3b8' : COLORS.secondary,
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: 'bold',
            cursor: (!allFilled || submitting) ? 'not-allowed' : 'pointer',
            marginTop: '4px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
          }}>
          {submitting ? 'Submitting...' : (<><Icon name="checkCircle" size={16} color="white" /> Submit for Review</>)}
        </button>
      </div>
    </div>
  )
}

export default UploadDocs
