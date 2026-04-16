import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import PropertyDetail from "./pages/PropertyDetail";
import CreateProperty from "./pages/CreateProperty";
import EditProperty from "./pages/EditProperty";
import MyProperties from "./pages/MyProperties";
import Search from "./pages/Search";
import Booking from "./pages/Booking";
import UserInfo from "./pages/UserInfo";
import ValidationIdentity from "./pages/ValidationIdentity";
import AdminDashboard from "./pages/AdminDashboard";
import Messaging from "./pages/Messaging";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/properties/new" element={<CreateProperty />} />
          <Route path="/properties/:id/edit" element={<EditProperty />} />
          <Route path="/properties/:id" element={<PropertyDetail />} />
          <Route path="/my-properties" element={<MyProperties />} />
          <Route path="/search" element={<Search />} />
          <Route path="/bookings" element={<Booking />} />
          <Route path="/profile" element={<UserInfo />} />
          <Route path="/become-owner" element={<ValidationIdentity />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/messages" element={<Messaging />}/>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
