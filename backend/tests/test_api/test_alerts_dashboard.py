def test_dashboard_endpoint(client, auth_headers):
    response = client.get("/api/v1/dashboard/", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "cpu_usage" in data
    assert "memory_total" in data
    assert "memory_used" in data
    assert "pools" in data
    assert "services" in data


def test_metrics_history(client, auth_headers):
    response = client.get("/api/v1/dashboard/metrics/history", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "cpu" in data
    assert "memory" in data


def test_alerts_lifecycle(client, auth_headers):
    # List alerts
    alerts_res = client.get("/api/v1/alerts/", headers=auth_headers)
    assert alerts_res.status_code == 200

    # Dismiss all
    dismiss_res = client.post("/api/v1/alerts/dismiss-all", headers=auth_headers)
    assert dismiss_res.status_code == 200
