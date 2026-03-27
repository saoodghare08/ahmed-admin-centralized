import { Routes, Route } from 'react-router-dom'
import CampaignList from './CampaignList'
import CampaignForm from './CampaignForm'

export default function Campaigns() {
  return (
    <Routes>
      <Route index element={<CampaignList />} />
      <Route path="new" element={<CampaignForm />} />
      <Route path=":id" element={<CampaignForm />} />
    </Routes>
  )
}
