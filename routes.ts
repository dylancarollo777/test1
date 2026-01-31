import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { 
  insertProjectSchema, 
  insertShowSchema,
  insertSeasonSchema,
  insertEpisodeSchema,
  insertPodcastSchema, 
  insertProjectMessageSchema, 
  insertProjectFileSchema,
  type Project,
  type Show,
  type Season,
  type Episode
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "No user ID found" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Object storage routes for protected file uploading
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req, res) => {
    const userId = req.user?.claims?.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  // Project routes
  app.get("/api/projects", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let projects: Project[];
      if (user.role === "client") {
        projects = await storage.getProjectsForClient(userId);
      } else if (user.role === "admin" || user.role === "producer") {
        projects = await storage.getAllProjects();
      } else {
        projects = [];
      }

      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.post("/api/projects", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const projectData = insertProjectSchema.parse({
        ...req.body,
        clientId: userId,
      });

      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.get("/api/projects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const project = await storage.getProject(req.params.id);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if user can access this project
      if (user?.role === "client" && project.clientId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.patch("/api/projects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Only admins and producers can update projects
      if (user?.role === "client") {
        return res.status(403).json({ message: "Access denied" });
      }

      const project = await storage.updateProject(req.params.id, req.body);
      res.json(project);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  // Podcast routes
  app.get("/api/podcasts", async (req, res) => {
    try {
      const podcasts = await storage.getPublishedPodcasts();
      res.json(podcasts);
    } catch (error) {
      console.error("Error fetching podcasts:", error);
      res.status(500).json({ message: "Failed to fetch podcasts" });
    }
  });

  app.get("/api/podcasts/:id", async (req, res) => {
    try {
      const podcast = await storage.getPodcast(req.params.id);
      if (!podcast || !podcast.isPublished) {
        return res.status(404).json({ message: "Podcast not found" });
      }
      res.json(podcast);
    } catch (error) {
      console.error("Error fetching podcast:", error);
      res.status(500).json({ message: "Failed to fetch podcast" });
    }
  });

  app.post("/api/podcasts/:id/play", async (req, res) => {
    try {
      await storage.incrementPlayCount(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error incrementing play count:", error);
      res.status(500).json({ message: "Failed to increment play count" });
    }
  });

  app.post("/api/podcasts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Only admins and producers can create podcasts
      if (user?.role === "client") {
        return res.status(403).json({ message: "Access denied" });
      }

      const podcastData = insertPodcastSchema.parse(req.body);
      const podcast = await storage.createPodcast(podcastData);
      res.status(201).json(podcast);
    } catch (error) {
      console.error("Error creating podcast:", error);
      res.status(500).json({ message: "Failed to create podcast" });
    }
  });

  // Project messages routes
  app.get("/api/projects/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const project = await storage.getProject(req.params.id);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if user can access this project
      if (user?.role === "client" && project.clientId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const includeInternal = user?.role !== "client";
      const messages = await storage.getProjectMessages(req.params.id, includeInternal);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/projects/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const project = await storage.getProject(req.params.id);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if user can access this project
      if (user?.role === "client" && project.clientId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const messageData = insertProjectMessageSchema.parse({
        ...req.body,
        projectId: req.params.id,
        userId: userId,
      });

      const message = await storage.createProjectMessage(messageData);
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // File upload handling
  app.put("/api/projects/:id/audio", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!req.body.audioFileUrl) {
        return res.status(400).json({ error: "audioFileUrl is required" });
      }

      // Only admins and producers can upload audio files
      if (user?.role === "client") {
        return res.status(403).json({ message: "Access denied" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.audioFileUrl,
        {
          owner: userId,
          visibility: "private",
        }
      );

      res.status(200).json({ objectPath });
    } catch (error) {
      console.error("Error uploading audio file:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Show/Series routes
  app.post("/api/shows", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      // Allow all authenticated users to create shows
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const showData = insertShowSchema.parse(req.body);
      const newShow = await storage.createShow(showData);
      res.status(201).json(newShow);
    } catch (error) {
      console.error("Error creating show:", error);
      res.status(400).json({ message: "Invalid show data" });
    }
  });

  app.get("/api/shows", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let shows: Show[];
      const { projectId, public: isPublic } = req.query;

      if (isPublic === "true") {
        shows = await storage.getPublicShows();
      } else if (projectId) {
        shows = await storage.getShowsForProject(projectId);
      } else if (user.role === "admin") {
        shows = await storage.getPublicShows();
      } else {
        const projects = user.role === "client" 
          ? await storage.getProjectsForClient(userId)
          : await storage.getProjectsForProducer(userId);
        
        const projectIds = projects.map(p => p.id);
        shows = [];
        for (const pId of projectIds) {
          const projectShows = await storage.getShowsForProject(pId);
          shows.push(...projectShows);
        }
      }

      res.json(shows);
    } catch (error) {
      console.error("Error fetching shows:", error);
      res.status(500).json({ message: "Failed to fetch shows" });
    }
  });

  app.get("/api/shows/:id", isAuthenticated, async (req, res) => {
    try {
      const show = await storage.getShow(req.params.id);
      if (!show) {
        return res.status(404).json({ message: "Show not found" });
      }
      res.json(show);
    } catch (error) {
      console.error("Error fetching show:", error);
      res.status(500).json({ message: "Failed to fetch show" });
    }
  });

  app.put("/api/shows/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      // Allow all authenticated users to update shows
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const updates = req.body;
      
      // Handle cover image upload
      if (updates.coverImageURL) {
        const objectStorageService = new ObjectStorageService();
        const coverPath = await objectStorageService.trySetObjectEntityAclPolicy(
          updates.coverImageURL,
          {
            owner: userId,
            visibility: "public",
          }
        );
        updates.coverImageUrl = coverPath;
        delete updates.coverImageURL;
      }

      const updatedShow = await storage.updateShow(req.params.id, updates);
      res.json(updatedShow);
    } catch (error) {
      console.error("Error updating show:", error);
      res.status(400).json({ message: "Failed to update show" });
    }
  });

  app.delete("/api/shows/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (!user || (user.role !== "producer" && user.role !== "admin")) {
        return res.status(403).json({ message: "Only producers and admins can delete shows" });
      }

      await storage.deleteShow(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting show:", error);
      res.status(500).json({ message: "Failed to delete show" });
    }
  });

  // Season routes
  app.post("/api/seasons", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      // Allow all authenticated users to create seasons
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const seasonData = insertSeasonSchema.parse(req.body);
      const newSeason = await storage.createSeason(seasonData);
      res.status(201).json(newSeason);
    } catch (error) {
      console.error("Error creating season:", error);
      res.status(400).json({ message: "Invalid season data" });
    }
  });

  app.get("/api/seasons", isAuthenticated, async (req, res) => {
    try {
      const { showId } = req.query;
      if (!showId) {
        return res.status(400).json({ message: "showId is required" });
      }

      const seasons = await storage.getSeasonsForShow(showId as string);
      res.json(seasons);
    } catch (error) {
      console.error("Error fetching seasons:", error);
      res.status(500).json({ message: "Failed to fetch seasons" });
    }
  });

  app.get("/api/seasons/:id", isAuthenticated, async (req, res) => {
    try {
      const season = await storage.getSeason(req.params.id);
      if (!season) {
        return res.status(404).json({ message: "Season not found" });
      }
      res.json(season);
    } catch (error) {
      console.error("Error fetching season:", error);
      res.status(500).json({ message: "Failed to fetch season" });
    }
  });

  app.put("/api/seasons/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      // Allow all authenticated users to update seasons
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const updates = req.body;
      
      // Handle cover image upload
      if (updates.coverImageURL) {
        const objectStorageService = new ObjectStorageService();
        const coverPath = await objectStorageService.trySetObjectEntityAclPolicy(
          updates.coverImageURL,
          {
            owner: userId,
            visibility: "public",
          }
        );
        updates.coverImageUrl = coverPath;
        delete updates.coverImageURL;
      }

      const updatedSeason = await storage.updateSeason(req.params.id, updates);
      res.json(updatedSeason);
    } catch (error) {
      console.error("Error updating season:", error);
      res.status(400).json({ message: "Failed to update season" });
    }
  });

  app.delete("/api/seasons/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      // Allow all authenticated users to delete seasons
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      await storage.deleteSeason(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting season:", error);
      res.status(500).json({ message: "Failed to delete season" });
    }
  });

  // Episode routes
  app.post("/api/episodes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      // Allow all authenticated users to create episodes
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const episodeData = insertEpisodeSchema.parse(req.body);
      const newEpisode = await storage.createEpisode(episodeData);
      res.status(201).json(newEpisode);
    } catch (error) {
      console.error("Error creating episode:", error);
      res.status(400).json({ message: "Invalid episode data" });
    }
  });

  app.get("/api/episodes", isAuthenticated, async (req, res) => {
    try {
      const { seasonId, published } = req.query;
      
      let episodes: Episode[];
      if (published === "true") {
        episodes = await storage.getPublishedEpisodes();
      } else if (seasonId) {
        episodes = await storage.getEpisodesForSeason(seasonId as string);
      } else {
        return res.status(400).json({ message: "seasonId parameter is required when not fetching published episodes" });
      }

      res.json(episodes);
    } catch (error) {
      console.error("Error fetching episodes:", error);
      res.status(500).json({ message: "Failed to fetch episodes" });
    }
  });

  app.get("/api/episodes/:id", isAuthenticated, async (req, res) => {
    try {
      const episode = await storage.getEpisode(req.params.id);
      if (!episode) {
        return res.status(404).json({ message: "Episode not found" });
      }
      res.json(episode);
    } catch (error) {
      console.error("Error fetching episode:", error);
      res.status(500).json({ message: "Failed to fetch episode" });
    }
  });

  app.put("/api/episodes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      // Allow all authenticated users to update episodes
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const updates = req.body;
      
      // Handle file upload updates
      if (updates.audioFileURL) {
        const objectStorageService = new ObjectStorageService();
        const audioPath = await objectStorageService.trySetObjectEntityAclPolicy(
          updates.audioFileURL,
          {
            owner: userId,
            visibility: updates.isPublished ? "public" : "private",
          }
        );
        updates.audioFileUrl = audioPath;
        delete updates.audioFileURL;
      }

      if (updates.coverImageURL) {
        const objectStorageService = new ObjectStorageService();
        const coverPath = await objectStorageService.trySetObjectEntityAclPolicy(
          updates.coverImageURL,
          {
            owner: userId,
            visibility: "public",
          }
        );
        updates.coverImageUrl = coverPath;
        delete updates.coverImageURL;
      }

      const updatedEpisode = await storage.updateEpisode(req.params.id, updates);
      res.json(updatedEpisode);
    } catch (error) {
      console.error("Error updating episode:", error);
      res.status(400).json({ message: "Failed to update episode" });
    }
  });

  app.delete("/api/episodes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      // Allow all authenticated users to delete episodes
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      await storage.deleteEpisode(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting episode:", error);
      res.status(500).json({ message: "Failed to delete episode" });
    }
  });

  // Episode analytics routes
  app.post("/api/episodes/:id/play", async (req, res) => {
    try {
      await storage.incrementEpisodePlayCount(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error incrementing play count:", error);
      res.status(500).json({ message: "Failed to increment play count" });
    }
  });

  app.post("/api/episodes/:id/download", async (req, res) => {
    try {
      await storage.incrementEpisodeDownloadCount(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error incrementing download count:", error);
      res.status(500).json({ message: "Failed to increment download count" });
    }
  });

  // User management routes (admin only)
  app.put("/api/users/:userId/role", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user?.claims?.sub;
      const currentUser = await storage.getUser(currentUserId);
      
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ message: "Only admins can change user roles" });
      }

      const { role } = req.body;
      if (!["client", "producer", "admin"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const targetUser = await storage.getUser(req.params.userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = await storage.upsertUser({
        ...targetUser,
        role: role
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
