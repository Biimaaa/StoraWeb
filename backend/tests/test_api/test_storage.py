from app.models.storage import Disk


def test_scan_and_list_disks(client, auth_headers, db_session):
    scan_res = client.post("/api/v1/disks/scan", headers=auth_headers)
    assert scan_res.status_code == 200

    list_res = client.get("/api/v1/disks/", headers=auth_headers)
    assert list_res.status_code == 200
    disks = list_res.json()
    assert len(disks) > 0


def test_pool_lifecycle(client, auth_headers, db_session):
    # Ensure disks exist
    client.post("/api/v1/disks/scan", headers=auth_headers)
    disks = client.get("/api/v1/disks/", headers=auth_headers).json()
    available_disks = [d for d in disks if d["pool_id"] is None]
    assert len(available_disks) >= 2

    # Create a mirror pool (US-01 / FR-2.2)
    pool_payload = {
        "name": "tank-test",
        "topology": {
            "data": [
                {
                    "vdev_type": "mirror",
                    "disk_ids": [available_disks[0]["id"], available_disks[1]["id"]],
                    "purpose": "data",
                }
            ]
        },
    }
    create_res = client.post("/api/v1/pools/", json=pool_payload, headers=auth_headers)
    assert create_res.status_code in (200, 201)
    pool = create_res.json()
    assert pool["name"] == "tank-test"
    assert pool["status"] == "ONLINE"
    pool_id = pool["id"]

    # Get pool details
    get_res = client.get(f"/api/v1/pools/{pool_id}", headers=auth_headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == pool_id

    # Create dataset inside pool (FR-3.1, FR-3.2)
    dataset_payload = {
        "name": "docs",
        "pool_id": pool_id,
        "dataset_type": "filesystem",
        "preset": "smb",
        "compression": "lz4",
    }
    ds_res = client.post("/api/v1/datasets/", json=dataset_payload, headers=auth_headers)
    assert ds_res.status_code in (200, 201)
    dataset = ds_res.json()
    assert dataset["name"] == "docs"
    assert dataset["path"] == "tank-test/docs"
    dataset_id = dataset["id"]

    # Create snapshot (FR-6.1)
    snap_res = client.post(
        "/api/v1/snapshots/",
        json={"dataset_id": dataset_id, "name": "snap1"},
        headers=auth_headers,
    )
    assert snap_res.status_code in (200, 201)
    snapshot = snap_res.json()
    assert snapshot["name"] == "snap1"

    # Rollback snapshot with confirmation (FR-6.3)
    rollback_res = client.post(
        f"/api/v1/snapshots/{snapshot['id']}/rollback",
        json={"confirm_name": "snap1"},
        headers=auth_headers,
    )
    assert rollback_res.status_code == 200

    # Start scrub on pool (FR-2.6)
    scrub_res = client.post(f"/api/v1/pools/{pool_id}/scrub", headers=auth_headers)
    assert scrub_res.status_code == 200

    # Clean up dataset & pool
    del_ds = client.request(
        "DELETE",
        f"/api/v1/datasets/{dataset_id}",
        json={"confirm_name": "tank-test/docs"},
        headers=auth_headers,
    )
    assert del_ds.status_code == 200

    del_pool = client.request(
        "DELETE",
        f"/api/v1/pools/{pool_id}",
        json={"confirm_name": "tank-test"},
        headers=auth_headers,
    )
    assert del_pool.status_code == 200
