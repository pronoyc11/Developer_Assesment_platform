export interface RecruiterProfileResponse {
  id: string;
  userId: string;
  companyName: string | null;
  companyDescription: string | null;
  companyWebsite: string | null;
  companyLogoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}
