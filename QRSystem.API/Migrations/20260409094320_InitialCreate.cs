using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QRSystem.API.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "QrCodes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Payload = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ImageUrl = table.Column<string>(type: "text", nullable: false),
                    GeneratedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QrCodes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FraudLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    IpAddress = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: false),
                    Username = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: false),
                    Details = table.Column<string>(type: "text", nullable: true),
                    DetectedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    QrCodeId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FraudLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FraudLogs_QrCodes_QrCodeId",
                        column: x => x.QrCodeId,
                        principalTable: "QrCodes",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ScanAttempts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Username = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    IpAddress = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: false),
                    Location = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ScannedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Result = table.Column<string>(type: "text", nullable: false),
                    QrCodeId = table.Column<Guid>(type: "uuid", nullable: true),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScanAttempts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScanAttempts_QrCodes_QrCodeId",
                        column: x => x.QrCodeId,
                        principalTable: "QrCodes",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_FraudLogs_QrCodeId",
                table: "FraudLogs",
                column: "QrCodeId");

            migrationBuilder.CreateIndex(
                name: "IX_QrCodes_SessionId_IsActive",
                table: "QrCodes",
                columns: new[] { "SessionId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_ScanAttempts_IpAddress_SessionId",
                table: "ScanAttempts",
                columns: new[] { "IpAddress", "SessionId" });

            migrationBuilder.CreateIndex(
                name: "IX_ScanAttempts_QrCodeId",
                table: "ScanAttempts",
                column: "QrCodeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FraudLogs");

            migrationBuilder.DropTable(
                name: "ScanAttempts");

            migrationBuilder.DropTable(
                name: "QrCodes");
        }
    }
}
