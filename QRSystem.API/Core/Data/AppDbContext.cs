using Microsoft.EntityFrameworkCore;
using QRSystem.API.Core.Models;

namespace QRSystem.API.Core.Data
{
    public class AppDbContext : DbContext
    {
        public DbSet<QrCode> QrCodes => Set<QrCode>();
        public DbSet<ScanAttempt> ScanAttempts => Set<ScanAttempt>();
        public DbSet<FraudLog> FraudLogs => Set<FraudLog>();
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", false);
        }
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<QrCode>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Payload).IsRequired().HasMaxLength(500);
                entity.Property(e => e.GeneratedAt).IsRequired().HasColumnType("timestamp with time zone");
                entity.Property(e => e.ExpiresAt).IsRequired().HasColumnType("timestamp with time zone");
                entity.Property(e => e.IsActive).HasDefaultValue(true);

                entity.HasIndex(e => new { e.EventId, e.IsActive });
            });

            modelBuilder.Entity<ScanAttempt>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Username).IsRequired().HasMaxLength(150);
                entity.Property(e => e.IpAddress).IsRequired().HasMaxLength(45);
                entity.Property(e => e.ScannedAt).IsRequired().HasColumnType("timestamp with time zone");
                entity.Property(e => e.Location).HasMaxLength(100);
                entity.Property(e => e.Result).IsRequired();

                entity.HasIndex(e => new { e.IpAddress, e.EventId });

                entity.HasOne(e => e.QrCode)
                      .WithMany(q => q.ScanAttempts)
                      .HasForeignKey(e => e.QrCodeId);
            });

            modelBuilder.Entity<FraudLog>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Username).IsRequired().HasMaxLength(150);
                entity.Property(e => e.IpAddress).IsRequired().HasMaxLength(45);
                entity.Property(e => e.Reason).IsRequired();
                entity.Property(e => e.DetectedAt).IsRequired().HasColumnType("timestamp with time zone");

                entity.HasOne<QrCode>()
                      .WithMany()
                      .HasForeignKey(e => e.QrCodeId);
            });
        }
    }
}
