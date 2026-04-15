import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Search from "./pages/Search";
import Home from "./pages/Home";
import Booking from "./pages/Booking";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/search" element={<Search />} />
          <Route path="/" element={<Home />} />
          <Route path="/bookings" element={<Booking />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
