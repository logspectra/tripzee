import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { Layout, RequireAuth } from './components/Layout';
import { Spinner } from './components/ui';
import { Home } from './pages/Home';
import { Login, Register } from './pages/Auth';

const Destinations = lazy(() => import('./pages/Destinations'));
const DestinationPage = lazy(() => import('./pages/DestinationPage'));
const MapExplorer = lazy(() => import('./pages/MapExplorer'));
const Planner = lazy(() => import('./pages/Planner'));
const TripPage = lazy(() => import('./pages/TripPage'));
const SharedTrip = lazy(() => import('./pages/SharedTrip'));
const Services = lazy(() => import('./pages/Services'));
const Rooms = lazy(() => import('./pages/Rooms'));
const RoomPage = lazy(() => import('./pages/RoomPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Community = lazy(() => import('./pages/Community'));
const Assistant = lazy(() => import('./pages/Assistant'));
const Admin = lazy(() => import('./pages/Admin'));
const NotFound = lazy(() => import('./pages/NotFound'));

export function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="destinations" element={<Destinations />} />
          <Route path="destinations/:slug" element={<DestinationPage />} />
          <Route path="map" element={<MapExplorer />} />
          <Route path="plan" element={<Planner />} />
          <Route path="shared/:token" element={<SharedTrip />} />
          <Route path="services" element={<Services />} />
          <Route path="community" element={<Community />} />
          <Route path="assistant" element={<Assistant />} />
          <Route path="trips/:id" element={<RequireAuth><TripPage /></RequireAuth>} />
          <Route path="rooms" element={<RequireAuth><Rooms /></RequireAuth>} />
          <Route path="rooms/:id" element={<RequireAuth><RoomPage /></RequireAuth>} />
          <Route path="dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
