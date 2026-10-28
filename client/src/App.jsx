import { BrowserRouter, Route, Routes } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import AIAssistantPage from './pages/AIAssistantPage'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import ListingEditorPage from './pages/ListingEditorPage'
import ListingDetailsPage from './pages/ListingDetailsPage'
import MyAuctionsPage from './pages/MyAuctionsPage'
import MyListingsPage from './pages/MyListingsPage'
import ProfilePage from './pages/ProfilePage'
import SavedSearchesPage from './pages/SavedSearchesPage'
import './App.css'

export default function App() {
  return <BrowserRouter><MainLayout><Routes><Route path="/" element={<HomePage />} /><Route path="/login" element={<AuthPage mode="login" />} /><Route path="/register" element={<AuthPage mode="register" />} /><Route path="/profile" element={<ProfilePage />} /><Route path="/ai-assistant" element={<AIAssistantPage />} /><Route path="/listings" element={<MyListingsPage />} /><Route path="/listings/new" element={<ListingEditorPage />} /><Route path="/listings/:id/edit" element={<ListingEditorPage edit />} /><Route path="/listings/:id" element={<ListingDetailsPage />} /><Route path="/auctions" element={<MyAuctionsPage />} /><Route path="/saved-searches" element={<SavedSearchesPage />} /></Routes></MainLayout></BrowserRouter>
}
