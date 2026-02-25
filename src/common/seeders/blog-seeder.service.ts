import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Blog } from '../../modules/blogs/entities/blog.entity';
import { BlogType } from '../../modules/blogs/enums/blog-type.enum';
import { AccountRole } from '../../modules/accounts/enums/account-role.enum';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { BlogRepository } from '../../modules/blogs/repositories/blog.repository';

/**
 * Blog Content Map Interface
 *
 * Defines the structure for mapping blog IDs to their corresponding content files.
 * This enables scalable bulk updates of blog content from external text files.
 */
interface BlogContentMap {
  [blogId: string]: string; // Maps blog ID to file path
}

/**
 * Blog Content File Mapping
 *
 * Configuration object that maps blog records to their content file paths.
 * Add new entries here to enable bulk content updates from external files.
 */
const BLOG_CONTENT_FILES: BlogContentMap = {
  'blog-1': 'data/blog.txt',
  // Add more mappings as needed:
  // 'blog-2': 'data/blog-2.txt',
  // 'blog-3': 'data/blog-3.txt',
};

/**
 * Blog Seeder Service
 *
 * Seeds Blog records for all CLINIC_MANAGER accounts.
 * Must run after AccountSeederService to ensure accounts exist.
 *
 * Idempotent: Uses check-then-insert pattern by checking if blogs exist before inserting.
 *
 * Features:
 * - Reads blog content from external text files
 * - Provides scalable pattern for mapping text files to blog records
 * - Supports bulk content updates via BlogContentMap
 */
@Injectable()
export class BlogSeederService {
  private readonly logger = new Logger(BlogSeederService.name);

  // Default content file path
  private readonly DEFAULT_CONTENT_FILE = 'data/blog.txt';

  // Blog titles
  private readonly TITLES = [
    'Understanding Diabetes Management',
    'The Importance of Regular Check-ups',
    'Healthy Eating for Heart Health',
    'Exercise Tips for Busy Professionals',
    'Mental Health Awareness',
    'Preventing Common Sports Injuries',
    'The Benefits of Yoga for Joint Health',
    'Managing Stress in Daily Life',
    'Nutrition Tips for Strong Bones',
    'Understanding Blood Pressure',
    'The Role of Sleep in Overall Health',
    'Vaccination: Why It Matters',
    'Managing Chronic Pain Effectively',
    'The Importance of Hydration',
    'Healthy Habits for a Better Life',
    'Understanding Allergies and Their Triggers',
    'The Benefits of Regular Exercise',
    'Mental Wellness: Signs to Watch For',
    'Nutrition for Children and Teens',
    'Preventing Falls in Older Adults',
  ];

  // Blog thumbnails
  private readonly THUMBNAILS = [
    'https://example.com/images/health1.jpg',
    'https://example.com/images/medical2.jpg',
    'https://example.com/images/wellness3.jpg',
    'https://example.com/images/news4.jpg',
    'https://example.com/images/education5.jpg',
    'https://example.com/images/diabetes.jpg',
    'https://example.com/images/checkup.jpg',
    'https://example.com/images/heart.jpg',
    'https://example.com/images/exercise.jpg',
    'https://example.com/images/mental.jpg',
  ];

  // Blog types
  private readonly BLOG_TYPES = Object.values(BlogType);

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly blogRepository: BlogRepository,
  ) {}

  /**
   * Seed Blog records for all CLINIC_MANAGER accounts
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   * Reads blog content from external text file (data/blog.txt) instead of hardcoded content.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed Blogs...');

      // Check if blogs already exist
      const existingBlogsCount = await this.blogRepository.count();

      if (existingBlogsCount > 0) {
        this.logger.log(
          `Blogs already exist (${existingBlogsCount} records). Skipping seeding.`,
        );
        return;
      }

      // Get all CLINIC_MANAGER accounts
      const allAccounts = await this.accountRepository.findAllAccounts();
      const clinicManagers = allAccounts.filter(
        (acc) => acc.role === AccountRole.CLINIC_MANAGER,
      );

      if (clinicManagers.length === 0) {
        this.logger.warn('No CLINIC_MANAGER accounts found. Skipping seeding.');
        return;
      }

      this.logger.log(`Found ${clinicManagers.length} CLINIC_MANAGER accounts`);

      // Read content from external file
      const blogContent = this.readContentFromFile(this.DEFAULT_CONTENT_FILE);

      // Create blog posts for each clinic
      const blogs: Blog[] = [];
      const blogsPerClinic = this.getRandomInt(3, 5);

      for (const clinicManager of clinicManagers) {
        for (let i = 0; i < blogsPerClinic; i++) {
          const blog = this.blogRepository.create({
            clinicId: clinicManager._id,
            title: this.getRandomTitle(),
            content: blogContent,
            thumbnail: this.getRandomThumbnail(),
            type: this.getRandomBlogType(),
          });
          blogs.push(blog);
        }
      }

      // Bulk save all blogs
      await this.blogRepository.saveBlogs(blogs);

      this.logger.log(`✅ Created ${blogs.length} Blog records`);
    } catch (error) {
      this.logger.error('Failed to seed Blogs', error.stack);
      throw error;
    }
  }

  /**
   * Read content from a text file
   *
   * Helper function that reads content from a text file given a file path.
   * Uses path.join(process.cwd(), ...) for path resolution relative to project root.
   *
   * @param {string} filePath - Relative path to the text file from project root
   * @returns {string} File content as a string
   * @throws {Error} If file cannot be read or does not exist
   *
   * @example
   * ```typescript
   * const content = this.readContentFromFile('data/blog.txt');
   * ```
   */
  readContentFromFile(filePath: string): string {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      this.logger.log(`Reading content from file: ${fullPath}`);

      const content = fs.readFileSync(fullPath, 'utf-8');
      this.logger.log(
        `Successfully read ${content.length} characters from ${filePath}`,
      );

      return content;
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.error(`File not found: ${filePath}`);
        throw new Error(`Content file not found: ${filePath}`);
      }
      this.logger.error(`Failed to read file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update blog content from file by blog ID
   *
   * Scalable method for updating multiple blog records from external text files.
   * Uses the BlogContentMap to determine which file to use for each blog.
   *
   * @param {string} blogId - The ID of the blog to update
   * @param {string} filePath - Path to the content file (optional, uses BLOG_CONTENT_FILES if not provided)
   * @returns {Promise<Blog | null>} Updated blog entity or null if not found
   *
   * @example
   * ```typescript
   * // Update using predefined mapping
   * await this.updateBlogContentFromFile('blog-1');
   *
   * // Update with custom file path
   * await this.updateBlogContentFromFile('blog-1', 'data/custom-content.txt');
   * ```
   */
  async updateBlogContentFromFile(
    blogId: string,
    filePath?: string,
  ): Promise<Blog | null> {
    try {
      // Find the blog by ID
      const blog = await this.blogRepository.findById(blogId);

      if (!blog) {
        this.logger.warn(`Blog with ID ${blogId} not found`);
        return null;
      }

      // Determine file path
      const contentFilePath = filePath || BLOG_CONTENT_FILES[blogId];

      if (!contentFilePath) {
        this.logger.warn(`No content file mapping found for blog ID ${blogId}`);
        return null;
      }

      // Read content from file
      const content = this.readContentFromFile(contentFilePath);

      // Update blog content
      blog.content = content;
      const updatedBlog = await this.blogRepository.saveBlog(blog);

      this.logger.log(
        `✅ Updated blog ${blogId} with content from ${contentFilePath}`,
      );

      return updatedBlog;
    } catch (error) {
      this.logger.error(
        `Failed to update blog ${blogId} from file: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Bulk update multiple blogs from their mapped content files
   *
   * Updates multiple blog records in a single operation using the BLOG_CONTENT_FILES mapping.
   * This provides an efficient way to refresh content for multiple blogs at once.
   *
   * @param {string[]} blogIds - Array of blog IDs to update (optional, updates all mapped blogs if not provided)
   * @returns {Promise<{ updated: number; failed: string[] }>} Result object with count of updated blogs and array of failed IDs
   *
   * @example
   * ```typescript
   * // Update all mapped blogs
   * const result = await this.bulkUpdateBlogContents();
   *
   * // Update specific blogs
   * const result = await this.bulkUpdateBlogContents(['blog-1', 'blog-2']);
   * ```
   */
  async bulkUpdateBlogContents(
    blogIds?: string[],
  ): Promise<{ updated: number; failed: string[] }> {
    const idsToUpdate = blogIds || Object.keys(BLOG_CONTENT_FILES);
    const failed: string[] = [];
    let updated = 0;

    this.logger.log(`Starting bulk update for ${idsToUpdate.length} blogs`);

    for (const blogId of idsToUpdate) {
      try {
        const result = await this.updateBlogContentFromFile(blogId);
        if (result) {
          updated++;
        } else {
          failed.push(blogId);
        }
      } catch (error) {
        this.logger.error(`Failed to update blog ${blogId}: ${error.message}`);
        failed.push(blogId);
      }
    }

    this.logger.log(
      `Bulk update complete: ${updated} updated, ${failed.length} failed`,
    );

    return { updated, failed };
  }

  /**
   * Get random title
   */
  private getRandomTitle(): string {
    return this.TITLES[Math.floor(Math.random() * this.TITLES.length)];
  }

  /**
   * Get random thumbnail
   */
  private getRandomThumbnail(): string {
    return this.THUMBNAILS[Math.floor(Math.random() * this.THUMBNAILS.length)];
  }

  /**
   * Get random blog type
   */
  private getRandomBlogType(): BlogType {
    return this.BLOG_TYPES[Math.floor(Math.random() * this.BLOG_TYPES.length)];
  }

  /**
   * Get random integer between min and max (inclusive)
   */
  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
