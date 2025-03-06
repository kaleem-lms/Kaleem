import json

import environ
import requests

env = environ.Env()


class ZoomService:
    def generate_access_token(self):
        url = "https://zoom.us/oauth/token"
        headers = {
            "Authorization": f"Basic {env('ZOOM_ACCOUNT_CREDENTIALS')}",
            "Content-Type": "application/x-www-form-urlencoded",
        }
        payload = f"grant_type=account_credentials&account_id={env('ZOOM_ACCOUNT_ID')}"

        response = requests.post(  # noqa: S113
            url=url,
            data=payload,
            headers=headers,
        )

        return response.json()["access_token"]

    def create_meeting(self, *, topic, duration, start_time, host_email):
        url = "https://api.zoom.us/v2/users/me/meetings/"

        payload = json.dumps(
            {
                "host_email": host_email,
                "topic": topic,
                "duration": duration,
                "start_time": start_time,
                "type": 2,
            },
        )
        headers = {
            "Authorization": f"Bearer {self.generate_access_token()}",
            "Content-Type": "application/json",
        }

        response = requests.request(  # noqa: S113
            "POST",
            url,
            headers=headers,
            data=payload,
        )

        return response.json()
