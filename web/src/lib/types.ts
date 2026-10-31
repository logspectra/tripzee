export type Locale = 'en' | 'hi';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  locale: Locale;
}

export interface Category {
  slug: string;
  name: string;
  nameHi: string;
}

export interface DestinationCard {
  id: string;
  slug: string;
  name: string;
  nameHi?: string | null;
  city: string;
  state: string;
  category: Category;
  lat: number;
  lng: number;
  summary: string;
  summaryHi?: string | null;
  imageUrl?: string | null;
  imageCredit?: string | null;
  interests: string[];
  avgRating: number | null;
  reviewCount: number;
  factsVerified: boolean;
  distanceKm?: number | null;
}

export interface Source {
  id: string;
  label: string;
  url: string;
  field?: string | null;
}

export interface DestinationDetail {
  id: string;
  slug: string;
  name: string;
  nameHi?: string | null;
  city: string;
  state: string;
  country: string;
  category: Category;
  lat: number;
  lng: number;
  coordsSource?: string | null;
  summary: string;
  summaryHi?: string | null;
  description: string;
  history?: string | null;
  culturalSignificance?: string | null;
  interests: string[];
  openingHours?: string | null;
  entryFee?: string | null;
  visitMinutes: number;
  bestTimeToVisit?: string | null;
  accessibility?: string | null;
  guidelines?: string | null;
  officialUrl?: string | null;
  ticketUrl?: string | null;
  factsVerified: boolean;
  lastVerifiedAt?: string | null;
  imageUrl?: string | null;
  imageCredit?: string | null;
  published: boolean;
  sources: Source[];
  rating: { average: number | null; count: number };
  ratingHistogram: Record<string, number>;
  nearby: DestinationCard[];
  saved: boolean;
  savedId?: string | null;
  reviewedByMe: boolean;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface City {
  name: string;
  count: number;
  lat: number;
  lng: number;
}

export interface GeoResult {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  type: string;
  source: string;
}

export interface SearchResponse {
  destinations: DestinationCard[];
  places: GeoResult[];
  placesError?: string | null;
}

export type PlaceType = 'hotel' | 'restaurant' | 'hospital' | 'pharmacy' | 'police' | 'atm' | 'fuel' | 'transport' | 'parking';

export interface NearbyPlace {
  id: string;
  name: string;
  type: PlaceType;
  subtype?: string | null;
  lat: number;
  lng: number;
  distanceKm: number;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  openingHours?: string | null;
  cuisine?: string | null;
  stars?: string | null;
  wheelchair?: string | null;
  osmUrl: string;
}

export interface NearbyResult {
  places: NearbyPlace[];
  source: 'overpass' | 'nominatim';
  attribution: string;
  fetchedAt: string;
}

export interface RouteResult {
  mode: 'driving' | 'walking';
  distanceKm: number;
  durationMin: number;
  geometry: [number, number][];
  steps: { instruction: string; distanceM: number }[];
  approximate: boolean;
  note?: string | null;
  source: string;
}

export type ItemKind = 'attraction' | 'food' | 'travel' | 'stay' | 'other';

export interface ItineraryItem {
  id?: string;
  day: number;
  position: number;
  startTime?: string | null;
  endTime?: string | null;
  title: string;
  kind: ItemKind;
  destinationId?: string | null;
  destinationSlug?: string | null;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
  estCost: number;
}

export type BudgetCategoryKey = 'transport' | 'accommodation' | 'food' | 'tickets' | 'misc';

export interface BudgetEstimate {
  tier: 'BUDGET' | 'MID' | 'COMFORT';
  lines: { category: BudgetCategoryKey; planned: number; basis: string }[];
  total: number;
  perPerson: number;
}

export interface PlanRequest {
  origin: string;
  city: string;
  startDate: string;
  endDate: string;
  travellers: number;
  budget: number;
  interests: string[];
  transport: 'car' | 'train' | 'bus' | 'flight';
  pace: 'relaxed' | 'moderate' | 'packed';
  title?: string;
}

export interface PlanDraft {
  title: string;
  city: string;
  cityLat: number;
  cityLng: number;
  originLat?: number | null;
  originLng?: number | null;
  oneWayKm?: number | null;
  startDate: string;
  endDate: string;
  days: number;
  generatedBy: string;
  items: ItineraryItem[];
  budget: BudgetEstimate;
  warnings: string[];
}

export interface TripSummary {
  id: string;
  title: string;
  origin: string;
  city: string;
  startDate: string;
  endDate: string;
  days: number;
  travellers: number;
  budget: number;
  generatedBy: string;
  role: 'owner' | 'member';
  createdAt: string;
}

export interface BudgetLine {
  category: BudgetCategoryKey;
  planned: number;
  actual: number;
  basis?: string | null;
}

export interface BudgetSummary {
  budget: number;
  travellers: number;
  lines: BudgetLine[];
  plannedTotal: number;
  actualTotal: number;
  remaining: number;
  perPersonPlanned: number;
  perPersonActual: number;
}

export interface Expense {
  id: string;
  category: BudgetCategoryKey;
  amount: number;
  note?: string | null;
  spentOn: string;
  userId: string;
  userName: string;
  canDelete: boolean;
}

export interface TripDetail {
  id: string;
  title: string;
  origin: string;
  originLat?: number | null;
  originLng?: number | null;
  city: string;
  startDate: string;
  endDate: string;
  days: number;
  travellers: number;
  budget: number;
  interests: string[];
  transport: string;
  pace: string;
  generatedBy: string;
  notes?: string | null;
  shareToken?: string | null;
  canEdit: boolean;
  isOwner: boolean;
  items: ItineraryItem[];
  budgetSummary: BudgetSummary;
  expenses: Expense[];
  rooms: { id: string; name: string }[];
  updatedAt: string;
}

export interface Review {
  id: string;
  rating: number;
  title: string;
  body: string;
  tip?: string | null;
  visitedOn?: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string };
  mine: boolean;
  destination?: { slug: string; name: string; city: string } | null;
  status: string;
}

export interface SavedPlace {
  id: string;
  name: string;
  kind?: string | null;
  lat?: number | null;
  lng?: number | null;
  externalRef?: string | null;
  destination?: DestinationCard | null;
  createdAt: string;
}

export interface Member {
  userId: string;
  name: string;
  role: 'OWNER' | 'MEMBER';
  sharingLocation: boolean;
  isMe: boolean;
  joinedAt: string;
}

export interface RoomMessage {
  id: string;
  userId: string;
  userName: string;
  body: string;
  kind: 'message' | 'update';
  createdAt: string;
}

export interface MeetingPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  meetAt?: string | null;
  note?: string | null;
  createdById: string;
  createdAt: string;
}

export interface SharedLocation {
  userId: string;
  name: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  updatedAt: string;
}

export interface TripRef {
  id: string;
  title: string;
  city: string;
  startDate: string;
  endDate: string;
}

export interface RoomSummary {
  id: string;
  name: string;
  memberCount: number;
  isOwner: boolean;
  trip?: TripRef | null;
  createdAt: string;
}

export interface RoomDetail {
  id: string;
  name: string;
  inviteCode: string;
  isOwner: boolean;
  trip?: TripRef | null;
  members: Member[];
  messages: RoomMessage[];
  meetingPoints: MeetingPoint[];
  locations: SharedLocation[];
  mySharing: boolean;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
}

export interface AssistantReply {
  reply: string;
  source: 'llm' | 'rules';
  destinations: DestinationCard[];
  suggestions: string[];
}
