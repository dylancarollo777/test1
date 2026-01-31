import {
  users,
  projects,
  shows,
  seasons,
  episodes,
  podcasts,
  projectMessages,
  projectFiles,
  type User,
  type UpsertUser,
  type Project,
  type InsertProject,
  type Show,
  type InsertShow,
  type Season,
  type InsertSeason,
  type Episode,
  type InsertEpisode,
  type Podcast,
  type InsertPodcast,
  type ProjectMessage,
  type InsertProjectMessage,
  type ProjectFile,
  type InsertProjectFile,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Project operations
  createProject(project: InsertProject): Promise<Project>;
  getProject(id: string): Promise<Project | undefined>;
  getProjectsForClient(clientId: string): Promise<Project[]>;
  getProjectsForProducer(producerId: string): Promise<Project[]>;
  getAllProjects(): Promise<Project[]>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project>;

  // Show operations
  createShow(show: InsertShow): Promise<Show>;
  getShow(id: string): Promise<Show | undefined>;
  getShowsForProject(projectId: string): Promise<Show[]>;
  getPublicShows(): Promise<Show[]>;
  updateShow(id: string, updates: Partial<Show>): Promise<Show>;
  deleteShow(id: string): Promise<void>;

  // Season operations
  createSeason(season: InsertSeason): Promise<Season>;
  getSeason(id: string): Promise<Season | undefined>;
  getSeasonsForShow(showId: string): Promise<Season[]>;
  updateSeason(id: string, updates: Partial<Season>): Promise<Season>;
  deleteSeason(id: string): Promise<void>;

  // Episode operations
  createEpisode(episode: InsertEpisode): Promise<Episode>;
  getEpisode(id: string): Promise<Episode | undefined>;
  getEpisodesForSeason(seasonId: string): Promise<Episode[]>;
  getPublishedEpisodes(): Promise<Episode[]>;
  updateEpisode(id: string, updates: Partial<Episode>): Promise<Episode>;
  deleteEpisode(id: string): Promise<void>;
  incrementEpisodePlayCount(id: string): Promise<void>;
  incrementEpisodeDownloadCount(id: string): Promise<void>;

  // Legacy podcast operations (deprecated but maintained for compatibility)
  createPodcast(podcast: InsertPodcast): Promise<Podcast>;
  getPodcast(id: string): Promise<Podcast | undefined>;
  getPodcastsForProject(projectId: string): Promise<Podcast[]>;
  getPublishedPodcasts(): Promise<Podcast[]>;
  updatePodcast(id: string, updates: Partial<Podcast>): Promise<Podcast>;
  incrementPlayCount(id: string): Promise<void>;

  // Message operations
  createProjectMessage(message: InsertProjectMessage): Promise<ProjectMessage>;
  getProjectMessages(projectId: string, includeInternal?: boolean): Promise<ProjectMessage[]>;

  // File operations
  createProjectFile(file: InsertProjectFile): Promise<ProjectFile>;
  getProjectFiles(projectId: string): Promise<ProjectFile[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Project operations
  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async getProjectsForClient(clientId: string): Promise<Project[]> {
    return await db.select().from(projects).where(eq(projects.clientId, clientId)).orderBy(desc(projects.createdAt));
  }

  async getProjectsForProducer(producerId: string): Promise<Project[]> {
    return await db.select().from(projects).where(eq(projects.assignedProducerId, producerId)).orderBy(desc(projects.createdAt));
  }

  async getAllProjects(): Promise<Project[]> {
    return await db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const [updatedProject] = await db
      .update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updatedProject;
  }

  // Show operations
  async createShow(show: InsertShow): Promise<Show> {
    const [newShow] = await db.insert(shows).values(show).returning();
    return newShow;
  }

  async getShow(id: string): Promise<Show | undefined> {
    const [show] = await db.select().from(shows).where(eq(shows.id, id));
    return show;
  }

  async getShowsForProject(projectId: string): Promise<Show[]> {
    return await db.select().from(shows).where(eq(shows.projectId, projectId)).orderBy(desc(shows.createdAt));
  }

  async getPublicShows(): Promise<Show[]> {
    return await db.select().from(shows).where(eq(shows.isPublic, true)).orderBy(desc(shows.createdAt));
  }

  async updateShow(id: string, updates: Partial<Show>): Promise<Show> {
    const [updatedShow] = await db
      .update(shows)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(shows.id, id))
      .returning();
    return updatedShow;
  }

  async deleteShow(id: string): Promise<void> {
    await db.delete(shows).where(eq(shows.id, id));
  }

  // Season operations
  async createSeason(season: InsertSeason): Promise<Season> {
    const [newSeason] = await db.insert(seasons).values(season).returning();
    return newSeason;
  }

  async getSeason(id: string): Promise<Season | undefined> {
    const [season] = await db.select().from(seasons).where(eq(seasons.id, id));
    return season;
  }

  async getSeasonsForShow(showId: string): Promise<Season[]> {
    return await db.select().from(seasons).where(eq(seasons.showId, showId)).orderBy(seasons.seasonNumber);
  }

  async updateSeason(id: string, updates: Partial<Season>): Promise<Season> {
    const [updatedSeason] = await db
      .update(seasons)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(seasons.id, id))
      .returning();
    return updatedSeason;
  }

  async deleteSeason(id: string): Promise<void> {
    await db.delete(seasons).where(eq(seasons.id, id));
  }

  // Episode operations
  async createEpisode(episode: InsertEpisode): Promise<Episode> {
    const [newEpisode] = await db.insert(episodes).values(episode).returning();
    return newEpisode;
  }

  async getEpisode(id: string): Promise<Episode | undefined> {
    const [episode] = await db.select().from(episodes).where(eq(episodes.id, id));
    return episode;
  }

  async getEpisodesForSeason(seasonId: string): Promise<Episode[]> {
    return await db.select().from(episodes).where(eq(episodes.seasonId, seasonId)).orderBy(episodes.episodeNumber);
  }

  async getPublishedEpisodes(): Promise<Episode[]> {
    return await db.select().from(episodes).where(eq(episodes.isPublished, true)).orderBy(desc(episodes.publishedAt));
  }

  async updateEpisode(id: string, updates: Partial<Episode>): Promise<Episode> {
    const [updatedEpisode] = await db
      .update(episodes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(episodes.id, id))
      .returning();
    return updatedEpisode;
  }

  async deleteEpisode(id: string): Promise<void> {
    await db.delete(episodes).where(eq(episodes.id, id));
  }

  async incrementEpisodePlayCount(id: string): Promise<void> {
    await db
      .update(episodes)
      .set({ playCount: sql`${episodes.playCount} + 1` })
      .where(eq(episodes.id, id));
  }

  async incrementEpisodeDownloadCount(id: string): Promise<void> {
    await db
      .update(episodes)
      .set({ downloadCount: sql`${episodes.downloadCount} + 1` })
      .where(eq(episodes.id, id));
  }

  // Legacy podcast operations (deprecated but maintained for compatibility)
  async createPodcast(podcast: InsertPodcast): Promise<Podcast> {
    const [newPodcast] = await db.insert(podcasts).values(podcast).returning();
    return newPodcast;
  }

  async getPodcast(id: string): Promise<Podcast | undefined> {
    const [podcast] = await db.select().from(podcasts).where(eq(podcasts.id, id));
    return podcast;
  }

  async getPodcastsForProject(projectId: string): Promise<Podcast[]> {
    return await db.select().from(podcasts).where(eq(podcasts.projectId, projectId)).orderBy(desc(podcasts.createdAt));
  }

  async getPublishedPodcasts(): Promise<Podcast[]> {
    return await db.select().from(podcasts).where(eq(podcasts.isPublished, true)).orderBy(desc(podcasts.publishedAt));
  }

  async updatePodcast(id: string, updates: Partial<Podcast>): Promise<Podcast> {
    const [updatedPodcast] = await db
      .update(podcasts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(podcasts.id, id))
      .returning();
    return updatedPodcast;
  }

  async incrementPlayCount(id: string): Promise<void> {
    await db
      .update(podcasts)
      .set({ playCount: sql`${podcasts.playCount} + 1` })
      .where(eq(podcasts.id, id));
  }

  // Message operations
  async createProjectMessage(message: InsertProjectMessage): Promise<ProjectMessage> {
    const [newMessage] = await db.insert(projectMessages).values(message).returning();
    return newMessage;
  }

  async getProjectMessages(projectId: string, includeInternal = false): Promise<ProjectMessage[]> {
    const conditions = includeInternal
      ? eq(projectMessages.projectId, projectId)
      : and(eq(projectMessages.projectId, projectId), eq(projectMessages.isInternal, false));
    
    return await db.select().from(projectMessages).where(conditions).orderBy(desc(projectMessages.createdAt));
  }

  // File operations
  async createProjectFile(file: InsertProjectFile): Promise<ProjectFile> {
    const [newFile] = await db.insert(projectFiles).values(file).returning();
    return newFile;
  }

  async getProjectFiles(projectId: string): Promise<ProjectFile[]> {
    return await db.select().from(projectFiles).where(eq(projectFiles.projectId, projectId)).orderBy(desc(projectFiles.createdAt));
  }
}

export const storage = new DatabaseStorage();