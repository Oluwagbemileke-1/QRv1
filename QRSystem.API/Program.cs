using AspNetCoreRateLimit;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using QR.API.Services.Implementations;
using QRSystem.API.BackgroundServices;
using QRSystem.API.Core.Data;
using QRSystem.API.Core.Settings;
using QRSystem.API.Infrastructure.Repositories.Implementation;
using QRSystem.API.Infrastructure.Repositories.Implementations;
using QRSystem.API.Infrastructure.Repositories.Interfaces;
using QRSystem.API.Services.Implementations;
using QRSystem.API.Services.Interfaces;
using Serilog;


// Top of Program.cs, before var builder = ...
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", false);

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Host.UseSerilog((context, services, configuration) =>
{
    configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext();
});

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        npgsqlOptions =>
        {
            npgsqlOptions.MigrationsHistoryTable("__EFMigrationsHistory", "qr_schema");
        }
    )
);

builder.Services.AddScoped<IQrCodeRepository, QrCodeRepository>();
builder.Services.AddScoped<IScanAttemptRepository, ScanAttemptRepository>();
builder.Services.AddScoped<IFraudLogRepository, FraudLogRepository>();

builder.Services.AddScoped<IQrService, QrService>();
builder.Services.AddScoped<IScanService, ScanService>();
builder.Services.AddScoped<IFraudService, FraudService>();

builder.Services.AddHostedService<QrRotationService>();

builder.Services.AddMemoryCache();
builder.Services.Configure<IpRateLimitOptions>(options =>
{
    options.GeneralRules = new List<RateLimitRule>
    {
        new RateLimitRule
        {
            Endpoint = "POST:/api/scan",
            Period = "1m",
            Limit = 5
        }
    };
});
builder.Services.AddInMemoryRateLimiting();
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();

builder.Services.Configure<QrSettings>(
    builder.Configuration.GetSection("QrSettings")
);

builder.Services.Configure<DjangoApiSettings>(
    builder.Configuration.GetSection("DjangoApi")
);

builder.Services.AddHttpClient<IDjangoValidationService, DjangoValidationService>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["DjangoSettings:BaseUrl"]!);
    client.Timeout = TimeSpan.FromSeconds(30);
});

var app = builder.Build();

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

app.UseSerilogRequestLogging();

app.MapGet("/", () => "API is running");
// Configure the HTTP request pipeline.

    app.UseSwagger();
    app.UseSwaggerUI();


app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
