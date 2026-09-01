export interface Artist {
  name: string;
  country: string;
}

export interface Album {
  id: number;
  title: string;
  year: number;
  seconds: number;
  tags: string[];
  artist: Artist;
}
