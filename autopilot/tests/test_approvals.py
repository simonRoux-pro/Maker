import sqlite3

from autopilot import approvals
from autopilot.approvals.action import RealAction
from autopilot.ledger import connect
from helpers import IsolatedCase


class TestApprovals(IsolatedCase):
    def setUp(self):
        super().setUp()
        self.conn = connect()
        self.action = RealAction(
            strategy="hello_revenue",
            kind="spend",
            summary="acheter un nom de domaine",
            platform="registrar",
            estimated_cost=9.0,
            risk="medium",
            payload={"domain": "exemple.fr"},
        )

    def tearDown(self):
        self.conn.close()
        super().tearDown()

    def test_create_then_approve(self):
        approval_id = approvals.create(self.conn, self.action)
        pending = approvals.list_by_status(self.conn, "pending")
        self.assertEqual(len(pending), 1)
        self.assertEqual(pending[0]["payload"]["domain"], "exemple.fr")

        record = approvals.approve(self.conn, approval_id, by="simon", note="ok")
        self.assertEqual(record["status"], "approved")
        self.assertEqual(record["decided_by"], "simon")
        self.assertEqual(approvals.list_by_status(self.conn, "pending"), [])

    def test_cannot_decide_twice(self):
        approval_id = approvals.create(self.conn, self.action)
        approvals.reject(self.conn, approval_id, by="simon")
        with self.assertRaises(ValueError):
            approvals.approve(self.conn, approval_id, by="simon")

    def test_unknown_id(self):
        with self.assertRaises(KeyError):
            approvals.approve(self.conn, 999, by="simon")

    def test_expiry(self):
        approval_id = approvals.create(self.conn, self.action)
        self.conn.execute(
            "UPDATE approvals SET created_at = '2020-01-01T00:00:00+00:00' WHERE id = ?",
            (approval_id,),
        )
        self.conn.commit()
        self.assertEqual(approvals.expire_older_than(self.conn, days=7), 1)
        self.assertEqual(approvals.get(self.conn, approval_id)["status"], "expired")

    def test_status_constraint(self):
        approval_id = approvals.create(self.conn, self.action)
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "UPDATE approvals SET status = 'valide-en-douce' WHERE id = ?",
                (approval_id,),
            )

    def test_rejects_unknown_kind(self):
        with self.assertRaises(ValueError):
            RealAction(strategy="s", kind="virement-sauvage", summary="x")
