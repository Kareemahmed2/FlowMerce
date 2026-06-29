package com.example.flowmerceproject.NotificationManagement.email;

public abstract class BaseEmailTemplate {

    public abstract String getSubject();

    protected abstract String buildBodyContent();

    // Template method — fixed HTML shell; subclasses only provide subject + inner content.
    public final String render() {
        return """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <style>
                    body { margin:0; padding:0; background:#f0f0f0; font-family:Arial,Helvetica,sans-serif; color:#333; }
                    .wrapper { max-width:600px; margin:32px auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.08); }
                    .header { background:#0F0E0C; padding:24px 32px; }
                    .header h1 { margin:0; color:#fff; font-size:22px; letter-spacing:1px; }
                    .body { padding:32px; }
                    .body h2 { margin-top:0; font-size:20px; color:#0F0E0C; }
                    .body p { line-height:1.6; margin:8px 0; }
                    .highlight-box { background:#f7f7f7; border-left:4px solid #0F0E0C; padding:16px 20px; border-radius:4px; margin:20px 0; }
                    table.items { width:100%%; border-collapse:collapse; margin:16px 0; font-size:14px; }
                    table.items th { background:#0F0E0C; color:#fff; padding:10px 12px; text-align:left; }
                    table.items td { padding:10px 12px; border-bottom:1px solid #eee; }
                    table.items tr:last-child td { border-bottom:none; }
                    .totals { margin-top:8px; text-align:right; font-size:14px; }
                    .totals .total-row { font-weight:bold; font-size:16px; margin-top:4px; }
                    .footer { background:#f9f9f9; padding:16px 32px; text-align:center; font-size:12px; color:#aaa; border-top:1px solid #eee; }
                  </style>
                </head>
                <body>
                  <div class="wrapper">
                    <div class="header"><h1>FlowMerce</h1></div>
                    <div class="body">
                      %s
                    </div>
                    <div class="footer">
                      <p>&copy; 2026 FlowMerce. All rights reserved.</p>
                      <p>This is an automated message — please do not reply.</p>
                    </div>
                  </div>
                </body>
                </html>
                """.formatted(buildBodyContent());
    }
}
