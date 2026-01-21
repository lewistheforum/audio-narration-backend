import { Injectable, Logger } from '@nestjs/common';
import { Blog } from '../../modules/blogs/entities/blog.entity';
import { BlogType } from '../../modules/blogs/enums/blog-type.enum';
import { AccountRole } from '../../modules/accounts/enums/account-role.enum';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { BlogRepository } from '../../modules/blogs/repositories/blog.repository';

/**
 * Blog Seeder Service
 *
 * Seeds Blog records for all CLINIC_ADMIN accounts.
 * Must run after AccountSeederService to ensure accounts exist.
 *
 * Idempotent: Uses check-then-insert pattern by checking if blogs exist before inserting.
 */
@Injectable()
export class BlogSeederService {
  private readonly logger = new Logger(BlogSeederService.name);

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

  // Blog contents
  private readonly CONTENTS = [
    'Comprehensive guide to managing diabetes through lifestyle changes and medication. Learn about blood sugar monitoring, dietary adjustments, and exercise routines that can help you maintain optimal glucose levels.',
    'Regular health check-ups are essential for early detection and prevention of diseases. Discover which screenings you should get based on your age, gender, and risk factors.',
    'Heart-healthy eating can significantly reduce your risk of cardiovascular disease. Learn about foods that promote heart health and those to avoid for optimal cardiac function.',
    'Finding time to exercise can be challenging with a busy schedule. Discover efficient workout routines that fit into your daily routine without requiring hours at the gym.',
    'Mental health is just as important as physical health. Learn about common mental health conditions, their symptoms, and when to seek professional help.',
    'Sports injuries are common but often preventable. Learn proper warm-up techniques, equipment usage, and recovery strategies to keep you active and injury-free.',
    'Yoga offers numerous benefits for joint health and flexibility. Discover poses and sequences that can help alleviate joint pain and improve range of motion.',
    'Chronic stress can have serious health implications. Learn effective stress management techniques including mindfulness, breathing exercises, and lifestyle adjustments.',
    'Strong bones are essential for overall health and mobility. Discover the best nutrients and exercises for maintaining bone density throughout your life.',
    'Blood pressure management is crucial for preventing heart disease and stroke. Learn about monitoring, lifestyle changes, and treatment options for hypertension.',
    'Quality sleep is fundamental to good health. Understand the importance of sleep hygiene and how to improve your sleep patterns for better overall wellness.',
    'Vaccinations protect against serious diseases and contribute to community immunity. Learn about recommended vaccines for different age groups and risk factors.',
    'Chronic pain affects millions of people worldwide. Explore various pain management strategies including medication, physical therapy, and alternative treatments.',
    'Proper hydration is essential for all bodily functions. Learn about the signs of dehydration and how to maintain optimal fluid intake throughout the day.',
    'Developing healthy habits can transform your life. Discover simple daily practices that can lead to significant improvements in physical and mental well-being.',
    'Allergies can range from mild annoyances to life-threatening conditions. Learn about common allergens, symptoms, and effective management strategies.',
    'Regular physical activity provides numerous health benefits. Discover how exercise can improve cardiovascular health, strengthen muscles, and boost mental wellness.',
    'Mental wellness encompasses emotional, psychological, and social well-being. Learn to recognize warning signs of mental health issues and when to seek support.',
    'Proper nutrition is crucial during childhood and adolescence. Learn about essential nutrients for growing bodies and how to encourage healthy eating habits in young people.',
    'Falls are a leading cause of injury among older adults. Discover prevention strategies including home modifications, exercises, and medical interventions.',
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
   * Seed Blog records for all CLINIC_ADMIN accounts
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
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

      // Get all CLINIC_ADMIN accounts
      const allAccounts = await this.accountRepository.findAllAccounts();
      const clinicAdmins = allAccounts.filter(
        (acc) => acc.role === AccountRole.CLINIC_ADMIN,
      );

      if (clinicAdmins.length === 0) {
        this.logger.warn('No CLINIC_ADMIN accounts found. Skipping seeding.');
        return;
      }

      this.logger.log(`Found ${clinicAdmins.length} CLINIC_ADMIN accounts`);

      // Create blog posts for each clinic
      const blogs: Blog[] = [];
      const blogsPerClinic = this.getRandomInt(3, 5);

      for (const clinicAdmin of clinicAdmins) {
        for (let i = 0; i < blogsPerClinic; i++) {
          const blog = this.blogRepository.create({
            clinicId: clinicAdmin._id,
            title: this.getRandomTitle(),
            content: this.getRandomContent(),
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
   * Get random title
   */
  private getRandomTitle(): string {
    return this.TITLES[Math.floor(Math.random() * this.TITLES.length)];
  }

  /**
   * Get random content
   */
  private getRandomContent(): string {
    return this.CONTENTS[Math.floor(Math.random() * this.CONTENTS.length)];
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
