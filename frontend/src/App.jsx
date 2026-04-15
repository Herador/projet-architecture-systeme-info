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
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
