
import { mockService } from './mockService';

const ANILIST_API = 'https://graphql.anilist.co';

export interface AniListMedia {
    id: number;
    title: {
        romaji: string;
        english: string;
        native: string;
    };
    description: string;
    coverImage: {
        large: string;
        extraLarge: string;
    };
    tags: { name: string }[];
    genres: string[];
    averageScore: number;
    popularity: number;
    status: string;
}

class AniListService {
    
    private async query(query: string, variables: any = {}) {
        try {
            const response = await fetch(ANILIST_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ query, variables })
            });
            
            if (!response.ok) throw new Error("AniList API Error");
            return await response.json();
        } catch (e) {
            console.warn("AniList Query Failed", e);
            return null;
        }
    }

    public async getTrendingManga(page: number = 1, perPage: number = 30): Promise<AniListMedia[]> {
        const query = `
        query ($page: Int, $perPage: Int) {
            Page (page: $page, perPage: $perPage) {
                media (sort: TRENDING_DESC, type: MANGA, isAdult: false) {
                    id
                    title {
                        romaji
                        english
                        native
                    }
                    description
                    coverImage {
                        large
                        extraLarge
                    }
                    genres
                    averageScore
                    popularity
                }
            }
        }
        `;
        
        const data = await this.query(query, { page, perPage });
        return data?.data?.Page?.media || [];
    }

    public async searchManga(title: string): Promise<AniListMedia | null> {
        const query = `
        query ($search: String) {
            Media (search: $search, type: MANGA, sort: POPULARITY_DESC) {
                id
                title {
                    romaji
                    english
                    native
                }
                description
                coverImage {
                    large
                    extraLarge
                }
                genres
                averageScore
                tags {
                    name
                }
            }
        }
        `;
        
        const data = await this.query(query, { search: title });
        return data?.data?.Media || null;
    }
}

export const anilistService = new AniListService();
